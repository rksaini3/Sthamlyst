'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Play, Pause, MessageCircle, Bookmark, Share2, Star, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

type Listing = {
  id: string
  title: string
  maker_name: string
  maker_city: string | null
  maker_id?: string
  price: number
  image_url: string | null
  voice_note_url: string | null
  voice_duration_sec: number | null
  is_boosted: boolean
  category: string | null
}

export default function VoicePlayerCard({ listing }: { listing: Listing }) {
  const router = useRouter()
  const { user } = useAuth()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  const [saved, setSaved] = useState(false)
  const [savePending, setSavePending] = useState(false)

  const [rating, setRating] = useState<{ avg: number; count: number } | null>(null)
  const [showFullPhoto, setShowFullPhoto] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function checkSaved() {
      const { data } = await supabase
        .from('saved_listings')
        .select('id')
        .eq('user_id', user!.id)
        .eq('product_id', listing.id)
        .maybeSingle()
      if (!cancelled) setSaved(!!data)
    }
    checkSaved()
    return () => {
      cancelled = true
    }
  }, [user?.id, listing.id])

  useEffect(() => {
    if (!listing.maker_id) return
    let cancelled = false

    async function loadRating() {
      const { data } = await supabase
        .from('seller_ratings_summary')
        .select('avg_rating, rating_count')
        .eq('seller_id', listing.maker_id)
        .maybeSingle()
      if (!cancelled && data) {
        setRating({ avg: data.avg_rating, count: data.rating_count })
      }
    }
    loadRating()
    return () => {
      cancelled = true
    }
  }, [listing.maker_id])

  function togglePlay(e: React.MouseEvent) {
    e.stopPropagation()
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  function handleTimeUpdate() {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    setProgress(audio.currentTime / audio.duration)
  }

  function handleEnded() {
    setIsPlaying(false)
    setProgress(0)
  }

  async function toggleSave(e: React.MouseEvent) {
    e.stopPropagation()
    if (!user || savePending) return
    setSavePending(true)
    const wasSaved = saved
    setSaved(!wasSaved)

    if (wasSaved) {
      const { error } = await supabase
        .from('saved_listings')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', listing.id)
      if (error) setSaved(true)
    } else {
      const { error } = await supabase
        .from('saved_listings')
        .insert({ user_id: user.id, product_id: listing.id })
      if (error) setSaved(false)
    }
    setSavePending(false)
  }

  async function handleShare(e: React.MouseEvent) {
    e.stopPropagation()
    const shareUrl = `${window.location.origin}/product/${listing.id}`
    const shareData = {
      title: listing.title,
      text: `${listing.title} — ₹${listing.price} — ${listing.maker_name}, ${listing.maker_city ?? 'Gonda'}`,
      url: shareUrl,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        // user ne share-sheet cancel kar di — koi error dikhane ki zaroorat nahi
      }
    } else {
      await navigator.clipboard.writeText(shareUrl)
    }
  }

  function openChat() {
    router.push(`/chat/new?listing=${listing.id}`)
  }

  function openFullPhoto(e: React.MouseEvent) {
    e.stopPropagation()
    if (listing.image_url) setShowFullPhoto(true)
  }

  return (
    <>
      <div
        onClick={openChat}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && openChat()}
        className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-3 flex gap-3 items-center relative cursor-pointer active:bg-stone-50 dark:active:bg-stone-800 transition-colors"
      >
        {listing.is_boosted && (
          <span className="absolute top-2 right-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
            ⭐ बूस्टेड
          </span>
        )}

        {/* Photo — apna alag click-zone, full-screen viewer kholta hai, chat nahi */}
        {listing.image_url ? (
          <button onClick={openFullPhoto} className="flex-shrink-0" aria-label="Photo poori dekhein">
            <Image
              src={listing.image_url}
              alt={listing.title}
              width={56}
              height={56}
              className="rounded-xl object-cover w-14 h-14"
            />
          </button>
        ) : (
          <div className="w-14 h-14 rounded-xl bg-stone-100 dark:bg-stone-800 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{listing.title}</p>
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <span className="truncate">{listing.maker_name} · {listing.maker_city ?? 'Gonda'}</span>
            {rating && rating.count > 0 && (
              <span className="flex items-center gap-0.5 text-amber-600 flex-shrink-0">
                <Star size={11} fill="currentColor" />
                {rating.avg} ({rating.count})
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-mehendi mt-0.5">₹{listing.price}</p>

          {listing.voice_note_url && (
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={togglePlay}
                aria-label={isPlaying ? 'रोकिए' : 'सुनिए'}
                className="w-8 h-8 rounded-full bg-mehendi text-white flex items-center justify-center flex-shrink-0"
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
              </button>
              <div className="flex-1 h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                <div
                  className="h-full bg-mehendi transition-all"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <audio
                ref={audioRef}
                src={listing.voice_note_url}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                preload="none"
              />
            </div>
          )}
        </div>

        {/* Chat/Save/Share — apna alag click-zone, event bubble-up rokte hain */}
        <div className="flex flex-col items-center gap-2.5 flex-shrink-0">
          <div className="flex flex-col items-center gap-0.5 text-mehendi pointer-events-none">
            <MessageCircle size={20} />
            <span className="text-[9px] font-medium">भाव करें</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleSave}
              aria-label={saved ? 'Saved se hataayein' : 'Save karein'}
              aria-pressed={saved}
              className={saved ? 'text-clay' : 'text-stone-400'}
            >
              <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
            </button>
            <button onClick={handleShare} aria-label="Share karein" className="text-stone-400">
              <Share2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Full-screen photo viewer */}
      {showFullPhoto && listing.image_url && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setShowFullPhoto(false)}
        >
          <button
            onClick={() => setShowFullPhoto(false)}
            aria-label="Band karein"
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={listing.image_url}
            alt={listing.title}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
