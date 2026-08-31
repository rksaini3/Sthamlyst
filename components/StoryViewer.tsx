'use client'

import { useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'

type StoryItem = {
  media_type: 'image' | 'video'
  media_url: string
  caption?: string | null
}

type StoryGroup = {
  user_id: string
  user: { full_name: string | null; avatar_url: string | null } | null
  items: StoryItem[]
}

export default function StoryViewer({
  groups,
  startIndex,
  onClose,
}: {
  groups: StoryGroup[]
  startIndex: number
  onClose: () => void
}) {
  const [groupIdx, setGroupIdx] = useState(startIndex)
  const [itemIdx, setItemIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [mediaError, setMediaError] = useState(false)
  const IMAGE_DURATION = 5000

  const group = groups[groupIdx]
  const item = group?.items[itemIdx]

  // Fix: only run the fixed-length wall-clock timer for images. Videos
  // advance themselves via onTimeUpdate/onEnded below, so their actual
  // playback length is what drives the progress bar and the "next"
  // trigger — not a flat 5s guess that could cut a longer video short
  // or leave a shorter one frozen on its last frame.
  useEffect(() => {
    if (!item) return
    setProgress(0)
    setMediaError(false)
    if (item.media_type !== 'image') return

    const start = Date.now()
    const tick = setInterval(() => {
      const pct = Math.min(((Date.now() - start) / IMAGE_DURATION) * 100, 100)
      setProgress(pct)
      if (pct >= 100) next()
    }, 50)
    return () => clearInterval(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdx, itemIdx])

  function next() {
    if (!group) return
    if (itemIdx < group.items.length - 1) {
      setItemIdx(itemIdx + 1)
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx(groupIdx + 1)
      setItemIdx(0)
    } else {
      onClose()
    }
  }

  function prev() {
    if (itemIdx > 0) {
      setItemIdx(itemIdx - 1)
    } else if (groupIdx > 0) {
      setGroupIdx(groupIdx - 1)
      setItemIdx(0)
    }
  }

  function handleVideoProgress(e: SyntheticEvent<HTMLVideoElement>) {
    const v = e.currentTarget
    if (v.duration) setProgress((v.currentTime / v.duration) * 100)
  }

  if (!item) return null

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="absolute top-2 left-2 right-2 flex gap-1 z-10">
        {group.items.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/30 rounded overflow-hidden">
            <div
              className="h-full bg-white"
              style={{ width: i < itemIdx ? '100%' : i === itemIdx ? `${progress}%` : '0%' }}
            />
          </div>
        ))}
      </div>

      <div className="absolute top-6 left-3 right-3 flex items-center gap-2 z-10">
        <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-bold overflow-hidden flex-none">
          {group.user?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.user.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            (group.user?.full_name?.[0] ?? '?').toUpperCase()
          )}
        </div>
        <span className="text-white text-sm font-semibold">{group.user?.full_name ?? 'User'}</span>
        <button onClick={onClose} className="ml-auto text-white text-xl px-2" aria-label="Close">
          ✕
        </button>
      </div>

      <button onClick={prev} className="absolute left-0 top-0 w-1/3 h-full z-10" aria-label="Previous" />
      <button onClick={next} className="absolute right-0 top-0 w-1/3 h-full z-10" aria-label="Next" />

      {mediaError ? (
        <p className="text-white/70 text-sm px-6 text-center">Yeh story load nahi ho paayi.</p>
      ) : item.media_type === 'video' ? (
        <video
          key={item.media_url}
          src={item.media_url}
          autoPlay
          muted
          playsInline
          onTimeUpdate={handleVideoProgress}
          onEnded={next}
          onError={() => setMediaError(true)}
          className="max-h-full max-w-full"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.media_url}
          alt=""
          onError={() => setMediaError(true)}
          className="max-h-full max-w-full object-contain"
        />
      )}

      {item.caption && (
        <p className="absolute bottom-8 left-4 right-4 text-white text-sm text-center">{item.caption}</p>
      )}
    </div>
  )
}
