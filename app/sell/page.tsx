'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])

  // ---- Ek hi recording — public voice-note bhi, Sahayak ka source bhi ----
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [sahayakLoading, setSahayakLoading] = useState(false)
  const [sahayakError, setSahayakError] = useState('')
  const [sahayakFilled, setSahayakFilled] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [photoProgress, setPhotoProgress] = useState<number | null>(null)
  const [voiceProgress, setVoiceProgress] = useState<number | null>(null)
  const [savingStep, setSavingStep] = useState(false)

  const [isOnline, setIsOnline] = useState(true)
  const [pendingRetry, setPendingRetry] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    function goOnline() { setIsOnline(true) }
    function goOffline() { setIsOnline(false) }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

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
      setSahayakFilled(false)
      setSahayakError('')

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((track) => track.stop())
        if (timerRef.current) clearInterval(timerRef.current)

        // Yehi recording ab Sahayak ko bhi bhej do — seller ko dobara
        // bolna nahi padega, ek hi recording se dono kaam ho jaate hain.
        await sendToSahayak(blob)
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
    setSahayakFilled(false)
    setSahayakError('')
  }

  async function sendToSahayak(blob: Blob) {
    setSahayakLoading(true)
    setSahayakError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setSahayakError('Sign in karke try karein.')
        return
      }

      const form = new FormData()
      form.append('audio', blob, 'sahayak.webm')
      form.append('mode', 'fixed_price')

      const res = await fetch('/api/generate-listing', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.limit_reached) {
          setSahayakError(
            `Is mahine ki ${data.limit} free Sahayak listings ho chuki hain. Unlimited ke liye Sthamly Pro lijiye.`
          )
        } else {
          throw new Error(data.error || 'Sahayak se jawab nahi mila')
        }
        return
      }

      if (data.title) setTitle(data.title)
      if (data.description) setDescription(data.description)
      if (data.category) setCategory(data.category)
      if (data.price) setPrice(String(data.price))
      setSahayakFilled(true)
    } catch (err: any) {
      setSahayakError(err?.message || 'Sahayak abhi kaam nahi kar paaya — neeche khud type kar lijiye.')
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
      setError('Daam daalna zaroori hai.')
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

      const { error: insertError } = await supabase.from('products').insert({
        title: title.trim(),
        description: description.trim() || null,
        maker_name: profileData?.full_name || 'Sthamly Seller',
        maker_city: profileData?.city || 'Gonda',
        maker_id: user.id,
        price: Number(price),
        image_url: imageUrl,
        category,
        is_service: false,
        stock: 1,
        is_active: true,
        listing_type: 'fixed_price',
        voice_note_url: audioPublicUrl,
        voice_duration_sec: recordSeconds,
        latitude: profileData?.latitude ?? null,
        longitude: profileData?.longitude ?? null,
      })

      if (insertError) throw new Error(insertError.message)

      router.push('/')
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
      <p className="text-xs text-stone-500 mb-5">Photo lijiye, phir bas ek baar boliye — baaki Sahayak sambhal lega</p>

      {!isOnline && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium rounded-xl px-3 py-2.5 mb-4">
          <WifiOff size={15} />
          Aap abhi offline hain. Form bharte rahiye — connection aate hi upload ho jayega.
        </div>
      )}

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

      {/* ---- Ek hi Voice Note — public bhi, Sahayak-source bhi ---- */}
      <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
        Voice Note (15 sec) — zaroori hai
      </label>
      <div className="border border-violet/30 bg-violet-light rounded-xl p-4 mb-1.5 flex flex-col items-center gap-2">
        {!audioUrl ? (
          <>
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={submitting}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-white disabled:opacity-40 ${recording ? 'bg-red-500' : 'bg-violet'}`}
            >
              {recording ? <Square size={20} /> : <Mic size={22} />}
            </button>
            {recording && <p className="text-xs text-red-500 animate-pulse">{recordSeconds}s / 15s</p>}
            {!recording && (
              <p className="text-xs text-stone-500 text-center">
                Boliye: &quot;ये मिट्टी का दिया है, चार का सेट, डेढ़ सौ रुपये&quot;
                <br />
                <span className="text-[10px] text-violet font-semibold flex items-center justify-center gap-1 mt-1">
                  <Sparkles size={11} /> Sahayak isi se Title/Price bhi bhar dega
                </span>
              </p>
            )}
          </>
        ) : (
          <div className="w-full">
            <div className="flex items-center gap-2">
              <audio src={audioUrl} controls className="flex-1" />
              {!submitting && (
                <button onClick={reRecordVoice} className="text-stone-400 flex-shrink-0" aria-label="Dobara record karein">
                  <RotateCcw size={18} />
                </button>
              )}
            </div>
            {sahayakLoading && (
              <p className="text-xs text-violet font-semibold flex items-center gap-1.5 mt-2">
                <Loader2 size={13} className="animate-spin" /> Sahayak sun raha hai, form bhar raha hai…
              </p>
            )}
            {sahayakFilled && !sahayakLoading && (
              <p className="text-xs text-mehendi font-semibold mt-2">✓ Sahayak ne form bhar diya — neeche check kar lijiye</p>
            )}
            {sahayakError && (
              <div className="mt-2">
                <p className="text-xs text-red-600">{sahayakError}</p>
                {sahayakError.includes('Sthamly Pro') && (
                  <Link href="/seller-pro" className="text-xs font-bold text-violet underline">
                    Sthamly Pro dekhein →
                  </Link>
                )}
              </div>
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

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
            शुरुआती दाम (₹)
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
        {submitting ? 'List ho raha hai…' : !isOnline ? 'Offline — Connection ka wait karein' : 'List Karein'}
      </button>
    </div>
  )
}
