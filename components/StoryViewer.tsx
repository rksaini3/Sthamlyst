'use client'

import { useEffect, useState } from 'react'

type StoryGroup = {
  user_id: string
  user: { full_name: string | null; avatar_url: string | null } | null
  items: any[]
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
  const DURATION = 5000

  const group = groups[groupIdx]
  const item = group?.items[itemIdx]

  useEffect(() => {
    if (!item) return
    setProgress(0)
    const start = Date.now()
    const tick = setInterval(() => {
      const pct = Math.min(((Date.now() - start) / DURATION) * 100, 100)
      setProgress(pct)
      if (pct >= 100) next()
    }, 50)
    return () => clearInterval(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdx, itemIdx])

  function next() {
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

  if (!item) return null

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="absolute top-2 left-2 right-2 flex gap-1 z-10">
        {group.items.map((_: any, i: number) => (
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
            <img src={group.user.avatar_url} className="w-full h-full object-cover" />
          ) : (
            (group.user?.full_name?.[0] ?? '?').toUpperCase()
          )}
        </div>
        <span className="text-white text-sm font-semibold">{group.user?.full_name ?? 'User'}</span>
        <button onClick={onClose} className="ml-auto text-white text-xl px-2">
          ✕
        </button>
      </div>

      <button onClick={prev} className="absolute left-0 top-0 w-1/3 h-full z-10" aria-label="Previous" />
      <button onClick={next} className="absolute right-0 top-0 w-1/3 h-full z-10" aria-label="Next" />

      {item.media_type === 'video' ? (
        <video src={item.media_url} autoPlay playsInline className="max-h-full max-w-full" />
      ) : (
        <img src={item.media_url} className="max-h-full max-w-full object-contain" />
      )}

      {item.caption && (
        <p className="absolute bottom-8 left-4 right-4 text-white text-sm text-center">{item.caption}</p>
      )}
    </div>
  )
}