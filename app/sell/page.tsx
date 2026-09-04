'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Square, RotateCcw, X } from 'lucide-react'
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
          // 15-second voice notes, jaisa plan mein tha — auto-stop
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
  }

  async function handleSubmit() {
    setError('')

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

    try {
      let imageUrl: string | null = null
      if (photoFile) {
        const photoPath = `${user.id}/${Date.now()}-${photoFile.name}`
        const { error: photoErr } = await supabase.storage.from('products').upload(photoPath, photoFile)
        if (photoErr) throw new Error('Photo upload fail: ' + photoErr.message)
        const { data: photoUrlData } = supabase.storage.from('products').getPublicUrl(photoPath)
        imageUrl = photoUrlData.publicUrl
      }

      const audioPath = `voice-notes/${user.id}-${Date.now()}.webm`
      const { error: audioErr } = await supabase.storage.from('audio').upload(audioPath, audioBlob, {
        contentType: 'audio/webm',
      })
      if (audioErr) throw new Error('Voice note upload fail: ' + audioErr.message)
      const { data: audioUrlData } = supabase.storage.from('audio').getPublicUrl(audioPath)

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
          voice_note_url: audioUrlData.publicUrl,
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
      setError(err?.message || 'Kuch galat ho gaya, dobara try karein.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto pb-24 px-4 pt-6">
      <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-1">Naya Listing</h1>
      <p className="text-xs text-stone-500 mb-5">Photo aur apni aawaz mein jaankari daalein</p>

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
        <div className="relative mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoPreview} alt="" className="w-full h-48 object-cover rounded-xl" />
          <button
            onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center h-32 border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-xl mb-4 cursor-pointer text-sm text-stone-400">
          📷 Photo chuniye
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
          />
        </label>
      )}

      {/* ---- Voice note ---- */}
      <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
        Voice Note (15 sec) — zaroori hai
      </label>
      <div className="border border-stone-200 dark:border-stone-700 rounded-xl p-4 mb-4 flex flex-col items-center gap-2">
        {!audioUrl ? (
          <>
            <button
              onClick={recording ? stopRecording : startRecording}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-white ${recording ? 'bg-red-500' : 'bg-mehendi'}`}
            >
              {recording ? <Square size={20} /> : <Mic size={22} />}
            </button>
            {recording && <p className="text-xs text-red-500 animate-pulse">{recordSeconds}s / 15s</p>}
            {!recording && <p className="text-xs text-stone-400">Apni aawaz mein saamaan ke baare mein batayein</p>}
          </>
        ) : (
          <div className="w-full flex items-center gap-2">
            <audio src={audioUrl} controls className="flex-1" />
            <button onClick={reRecordVoice} className="text-stone-400" aria-label="Dobara record karein">
              <RotateCcw size={18} />
            </button>
          </div>
        )}
      </div>

      {/* ---- Title / Description ---- */}
      <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Title</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Jaise: Hand-Painted Clay Diya (Set of 4)"
        className="w-full border border-stone-300 dark:border-stone-700 dark:bg-stone-800 rounded-xl px-3 py-2.5 text-sm mb-4"
      />

      <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Description</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="Saamaan ke baare mein thodi jaankari"
        className="w-full border border-stone-300 dark:border-stone-700 dark:bg-stone-800 rounded-xl px-3 py-2.5 text-sm mb-4"
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
            placeholder="149"
            className="w-full border border-stone-300 dark:border-stone-700 dark:bg-stone-800 rounded-xl px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-stone-300 dark:border-stone-700 dark:bg-stone-800 rounded-xl px-3 py-2.5 text-sm"
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
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${auctionHours === 3 ? 'bg-mehendi text-white border-mehendi' : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'}`}
            >
              3 ghante
            </button>
            <button
              onClick={() => setAuctionHours(6)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${auctionHours === 6 ? 'bg-mehendi text-white border-mehendi' : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'}`}
            >
              6 ghante
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-stone-900 dark:bg-clay text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50"
      >
        {submitting ? 'List ho raha hai…' : listingType === 'auction' ? '🔨 Boli Shuru Karein' : 'List Karein'}
      </button>
    </div>
  )
}
