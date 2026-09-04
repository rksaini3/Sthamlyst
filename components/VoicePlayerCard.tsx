'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Play, Pause, MessageCircle } from 'lucide-react'
import Link from 'next/link'

type Listing = {
  id: string
  title: string
  maker_name: string
  maker_city: string | null
  price: number
  image_url: string | null
  voice_note_url: string | null
  voice_duration_sec: number | null
  is_boosted: boolean
  category: string | null
}

export default function VoicePlayerCard({ listing }: { listing: Listing }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // 0 to 1

  function togglePlay() {
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

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-3 flex gap-3 items-center relative">
      {listing.is_boosted && (
        <span className="absolute top-2 right-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
          ⭐ बूस्टेड
        </span>
      )}

      {listing.image_url ? (
        <Image
          src={listing.image_url}
          alt={listing.title}
          width={56}
          height={56}
          className="rounded-xl object-cover w-14 h-14 flex-shrink-0"
        />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-stone-100 dark:bg-stone-800 flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{listing.title}</p>
        <p className="text-xs text-stone-500 truncate">
          {listing.maker_name} · {listing.maker_city ?? 'Gonda'}
        </p>
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

      <Link
        href={`/chat/new?listing=${listing.id}`}
        className="flex flex-col items-center gap-0.5 text-mehendi flex-shrink-0"
        aria-label="बोलकर भाव करें"
      >
        <MessageCircle size={22} />
        <span className="text-[9px] font-medium">भाव करें</span>
      </Link>
    </div>
  )
}
