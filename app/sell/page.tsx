'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Square, RotateCcw, X, WifiOff, Sparkles, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

const CATEGORIES = [
  'Clay Crafts & Home Decor',
  'Flowers & Decor',
  'Clothing',
  'Painting & Art',
  'Antiques',
  'Food & Snacks',
  'Other',
]

const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // 5MB

// ---- Real byte-level upload progress via XHR straight to Supabase Storage's
// REST endpoint (the JS SDK's .upload() doesn't expose progress events) ----
async function uploadWithProgress(
  bucket: string,
  path: string,
  file: Blob,
  contentType: string,
  onProgress: (pct: number) => void
): Promise<string> {
  const supabaseUrl = (supabase as any).supabaseUrl as string
  const supabaseKey = (supabase as any).supabaseKey as string
  const { data: { session } } = await supabase.auth.getSession()

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${supabaseUrl}/storage/v1/object/${bucket}/${path}`, true)
    xhr.setRequestHeader('apikey', supabaseKey)
    xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token || supabaseKey}`)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.setRequestHeader('x-upsert', 'false')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        const { data } = supabase.storage.from(bucket).getPublicUrl(path)
        resolve(data.publicUrl)
      } else {
        reject(new Error(`Upload fail (${xhr.status}): ${xhr.responseText || 'server error'}`))
      }
    }
    xhr.onerror = () => reject(new Error('Network error — upload nahi ho paaya'))
    xhr.send(file)
  })
}

export default function SellPage() {
  const router = useRouter()
  const { user } = useAuth()

  const [itemType, setItemType] = useState<'product' | 'service'>('product')
  const [listingType, setListingType] = useState<'fixed_price' | 'auction'>('fixed_price')

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [auctionHours, setAuctionHours] = useState<3 | 6>(3)

  // ---- Sahayak AI (voice se form bharna) ----
  const [sahayakRecording, setSahayakRecording] = useState(false)
  const [sahayakLoading, setSahayakLoading] = useState(false)
  const [sahayakError, setSahayakError] = useState('')
  const sahayakRecorderRef = useRef<MediaRecorder | null>(null)
  const sahayakChunksRef = useRef<Blob[]>([])

  // ---- Voice note recording ----
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // ---- Upload progress ----
  const [photoProgress, setPhotoProgress] = useState<number | null>(null)
  const [voiceProgress, setVoiceProgress] = useState<number | null>(null)
  const [savingStep, setSavingStep] = useState(false)

  // ---- Offline detection ----
  const [isOnline, setIsOnline] = useState(true)
  const [pendingRetry, setPendingRetry] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    function goOnline() {
      setIsOnline(true)
    }
    function goOffline() {
      setIsOnline(false)
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Jaise hi connection wapas aaye, agar user submit karne ki koshish
  // offline mein rok di gayi thi, to apne aap dobara try karo.
  useEffect(() => {
    if (isOnline && pendingRetry) {
      setPendingRetry(false)
      handleSubmit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  function handlePhotoChange(file: File | null) {
    setError('')
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Sirf image file select karo.')
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError('Photo 5MB se chhoti honi chahiye.')
      return
    }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      setRecordSeconds(0)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((track) => track.stop())
        if (timerRef.current) clearInterval(timerRef.current)
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)

      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s >= 14) {
            recorder.stop()
            setRecording(false)
            return 15
          }
          return s + 1
        })
      }, 1000)
    } catch {
      setError('Microphone access nahi mil paaya. Settings mein permission check karein.')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  function reRecordVoice() {
    setAudioBlob(null)
    setAudioUrl(null)
    setRecordSeconds(0)
    setVoiceProgress(null)
  }

  async function startSahayakRecording() {
    setSahayakError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      sahayakChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) sahayakChunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(sahayakChunksRef.current, { type: 'audio/webm' })
        await sendToSahayak(blob)
      }

      recorder.start()
      sahayakRecorderRef.current = recorder
      setSahayakRecording(true)
    } catch {
      setSahayakError('Microphone access nahi mil paaya.')
    }
  }

  function stopSahayakRecording() {
    sahayakRecorderRef.current?.stop()
    setSahayakRecording(false)
  }

  async function sendToSahayak(blob: Blob) {
    setSahayakLoading(true)
    setSahayakError('')
    try {
      const form = new FormData()
      form.append('audio', blob, 'sahayak.webm')

      const res = await fetch('/api/generate-listing', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Sahayak se jawab nahi mila')

      if (data.title) setTitle(data.title)
      if (data.description) setDescription(data.description)
      if (data.category) setCategory(data.category)
      if (data.price) setPrice(String(data.price))
    } catch (err: any) {
      setSahayakError(err?.message || 'Sahayak abhi kaam nahi kar paaya, khud type kar lijiye.')
    } finally {
      setSahayakLoading(false)
    }
  }

  async function handleSubmit() {
    setError('')

    if (!navigator.onLine) {
      setError('Aap offline hain. Connection wapas aate hi listing apne aap upload ho jayegi.')
      setPendingRetry(true)
      return
    }
    if (!user) {
      setError('Sign in karke try karein.')
      return
    }
    if (!title.trim()) {
      setError('Title daalna zaroori hai.')
      return
    }
    if (!price || Number(price) <= 0) {
      setError(listingType === 'auction' ? 'Base price daalna zaroori hai.' : 'Price daalna zaroori hai.')
      return
    }
    if (!audioBlob) {
      setError('Voice note record karna zaroori hai — bina aawaz ke listing nahi ban sakti.')
      return
    }

    setSubmitting(true)
    setPhotoProgress(photoFile ? 0 : null)
    setVoiceProgress(0)

    try {
      let imageUrl: string | null = null
      if (photoFile) {
        const photoPath = `${user.id}/${Date.now()}-${photoFile.name}`
        try {
          imageUrl = await uploadWithProgress('products', photoPath, photoFile, photoFile.type, setPhotoProgress)
        } catch (err: any) {
          throw new Error('Photo upload fail: ' + err.message)
        }
      }

      const audioPath = `${user.id}/${Date.now()}-voicenote.webm`
      let audioPublicUrl: string
      try {
        audioPublicUrl = await uploadWithProgress('comment-audio', audioPath, audioBlob, 'audio/webm', setVoiceProgress)
      } catch (err: any) {
        throw new Error('Voice note upload fail: ' + err.message)
      }

      setSavingStep(true)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, city, latitude, longitude')
        .eq('id', user.id)
        .single()

      const { data: inserted, error: insertError } = await supabase
        .from('products')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          maker_name: profileData?.full_name || 'Sthamly Seller',
          maker_city: profileData?.city || 'Gonda',
          maker_id: user.id,
          price: Number(price),
          image_url: imageUrl,
          category,
          is_service: itemType === 'service',
          stock: 1,
          is_active: true,
          listing_type: listingType,
          voice_note_url: audioPublicUrl,
          voice_duration_sec: recordSeconds,
          latitude: profileData?.latitude ?? null,
          longitude: profileData?.longitude ?? null,
        })
        .select('id')
        .single()

      if (insertError) throw new Error(insertError.message)

      if (listingType === 'auction' && inserted) {
        const { error: auctionError } = await supabase.from('auctions').insert({
          product_id: inserted.id,
          seller_id: user.id,
          base_price: Number(price),
          end_time: new Date(Date.now() + auctionHours * 60 * 60 * 1000).toISOString(),
          status: 'live',
        })
        if (auctionError) throw new Error('Auction create nahi ho payi: ' + auctionError.message)
        router.push('/boli')
      } else {
        router.push('/')
      }
    } catch (err: any) {
      if (!navigator.onLine) {
        setError('Connection beech mein toot gaya. Wapas aate hi dobara try hoga.')
        setPendingRetry(true)
      } else {
        setError(err?.message || 'Kuch galat ho gaya, dobara try karein.')
      }
    } finally {
      setSubmitting(false)
      setSavingStep(false)
    }
  }

  const overallProgress = (() => {
    const parts = [photoFile ? photoProgress ?? 0 : null, voiceProgress ?? 0].filter((p) => p !== null) as number[]
    if (parts.length === 0) return 0
    return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length)
  })()

  return (
    <div className="max-w-md mx-auto pb-24 px-4 pt-6">
      <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-1">Naya Listing</h1>
      <p className="text-xs text-stone-500 mb-5">Photo aur apni aawaz mein jaankari daalein</p>

      {!isOnline && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium rounded-xl px-3 py-2.5 mb-4">
          <WifiOff size={15} />
          Aap abhi offline hain. Form bharte rahiye — connection aate hi upload ho jayega.
        </div>
      )}

      {/* ---- Product / Service ---- */}
      <div className="flex rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 mb-4">
        <button
          onClick={() => setItemType('product')}
          className={`flex-1 py-2.5 text-sm font-semibold ${itemType === 'product' ? 'bg-clay text-white' : 'bg-stone-50 dark:bg-stone-800 text-stone-500'}`}
        >
          🏺 Product
        </button>
        <button
          onClick={() => setItemType('service')}
          className={`flex-1 py-2.5 text-sm font-semibold ${itemType === 'service' ? 'bg-clay text-white' : 'bg-stone-50 dark:bg-stone-800 text-stone-500'}`}
        >
          🛠️ Service
        </button>
      </div>

      {/* ---- Fixed Price / Auction ---- */}
      <div className="flex rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 mb-5">
        <button
          onClick={() => setListingType('fixed_price')}
          className={`flex-1 py-2.5 text-sm font-semibold ${listingType === 'fixed_price' ? 'bg-mehendi text-white' : 'bg-stone-50 dark:bg-stone-800 text-stone-500'}`}
        >
          💬 Bhaav Karke Bechein
        </button>
        <button
          onClick={() => setListingType('auction')}
          className={`flex-1 py-2.5 text-sm font-semibold ${listingType === 'auction' ? 'bg-mehendi text-white' : 'bg-stone-50 dark:bg-stone-800 text-stone-500'}`}
        >
          🔨 Boli Lagwayein
        </button>
      </div>

      {/* ---- Photo ---- */}
      <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Product Photo</label>
      {photoPreview ? (
        <div className="relative mb-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoPreview} alt="" className="w-full h-48 object-cover rounded-xl" />
          {!submitting && (
            <button
              onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <label className="flex items-center justify-center h-32 border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-xl mb-1.5 cursor-pointer text-sm text-stone-400">
          📷 Photo chuniye
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
      {photoFile && photoProgress !== null && (
        <div className="mb-4">
          <div className="h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
            <div className="h-full bg-clay transition-all" style={{ width: `${photoProgress}%` }} />
          </div>
          <p className="text-[10px] text-stone-400 mt-0.5">Photo upload: {photoProgress}%</p>
        </div>
      )}
      {!(photoFile && photoProgress !== null) && <div className="mb-4" />}

      {/* ---- Voice note ---- */}
      <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
        Voice Note (15 sec) — zaroori hai
      </label>
      <div className="border border-stone-200 dark:border-stone-700 rounded-xl p-4 mb-1.5 flex flex-col items-center gap-2">
        {!audioUrl ? (
          <>
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={submitting}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-white disabled:opacity-40 ${recording ? 'bg-red-500' : 'bg-mehendi'}`}
            >
              {recording ? <Square size={20} /> : <Mic size={22} />}
            </button>
            {recording && <p className="text-xs text-red-500 animate-pulse">{recordSeconds}s / 15s</p>}
            {!recording && <p className="text-xs text-stone-400">Apni aawaz mein saamaan ke baare mein batayein</p>}
          </>
        ) : (
          <div className="w-full flex items-center gap-2">
            <audio src={audioUrl} controls className="flex-1" />
            {!submitting && (
              <button onClick={reRecordVoice} className="text-stone-400" aria-label="Dobara record karein">
                <RotateCcw size={18} />
              </button>
            )}
          </div>
        )}
      </div>
      {voiceProgress !== null && (
        <div className="mb-4">
          <div className="h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
            <div className="h-full bg-mehendi transition-all" style={{ width: `${voiceProgress}%` }} />
          </div>
          <p className="text-[10px] text-stone-400 mt-0.5">Voice note upload: {voiceProgress}%</p>
        </div>
      )}
      {voiceProgress === null && <div className="mb-4" />}

      {/* ---- Sahayak AI: voice se Title/Description bharwao ---- */}
      <div className="mb-4 border border-violet/30 bg-violet-light rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={15} className="text-violet" />
          <p className="text-xs font-bold text-violet">Sahayak se boliye — form khud bhar jayega</p>
        </div>
        <button
          onClick={sahayakRecording ? stopSahayakRecording : startSahayakRecording}
          disabled={sahayakLoading}
          className={`w-full flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 ${
            sahayakRecording ? 'bg-red-500 text-white' : 'bg-violet text-white'
          }`}
        >
          {sahayakLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Sun raha hoon, likh raha hoon…
            </>
          ) : sahayakRecording ? (
            <>
              <Square size={14} /> Ruko, ho gaya
            </>
          ) : (
            <>
              <Mic size={16} /> Boliye: &quot;ये मिट्टी का दिया है, चार का सेट, डेढ़ सौ रुपये&quot;
            </>
          )}
        </button>
        {sahayakError && <p className="text-xs text-red-600 mt-1.5">{sahayakError}</p>}
      </div>

      {/* ---- Title / Description ---- */}
      <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Title</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={submitting}
        placeholder="Jaise: Hand-Painted Clay Diya (Set of 4)"
        className="w-full border border-stone-300 dark:border-stone-700 dark:bg-stone-800 rounded-xl px-3 py-2.5 text-sm mb-4 disabled:opacity-50"
      />

      <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Description</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={submitting}
        rows={3}
        placeholder="Saamaan ke baare mein thodi jaankari"
        className="w-full border border-stone-300 dark:border-stone-700 dark:bg-stone-800 rounded-xl px-3 py-2.5 text-sm mb-4 disabled:opacity-50"
      />

      {/* ---- Price / Category ---- */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
            {listingType === 'auction' ? 'Base Price (₹)' : 'Price (₹)'}
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={submitting}
            placeholder="149"
            className="w-full border border-stone-300 dark:border-stone-700 dark:bg-stone-800 rounded-xl px-3 py-2.5 text-sm disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={submitting}
            className="w-full border border-stone-300 dark:border-stone-700 dark:bg-stone-800 rounded-xl px-3 py-2.5 text-sm disabled:opacity-50"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ---- Auction duration ---- */}
      {listingType === 'auction' && (
        <div className="mb-4">
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Boli ka samay</label>
          <div className="flex gap-2">
            <button
              onClick={() => setAuctionHours(3)}
              disabled={submitting}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border disabled:opacity-50 ${auctionHours === 3 ? 'bg-mehendi text-white border-mehendi' : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'}`}
            >
              3 ghante
            </button>
            <button
              onClick={() => setAuctionHours(6)}
              disabled={submitting}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border disabled:opacity-50 ${auctionHours === 6 ? 'bg-mehendi text-white border-mehendi' : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'}`}
            >
              6 ghante
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {submitting && (
        <div className="mb-3">
          <div className="h-2 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
            <div className="h-full bg-stone-900 dark:bg-clay transition-all" style={{ width: `${savingStep ? 100 : overallProgress}%` }} />
          </div>
          <p className="text-[11px] text-stone-500 mt-1 text-center">
            {savingStep ? 'Listing save ho rahi hai…' : `Upload ho raha hai… ${overallProgress}%`}
          </p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-stone-900 dark:bg-clay text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50"
      >
        {submitting
          ? 'List ho raha hai…'
          : !isOnline
          ? 'Offline — Connection ka wait karein'
          : listingType === 'auction'
          ? '🔨 Boli Shuru Karein'
          : 'List Karein'}
      </button>
    </div>
  )
}
