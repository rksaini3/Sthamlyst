'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

type Story = {
  id: string
  user_id: string
  media_url: string
  media_type: 'image' | 'video'
  caption: string | null
  created_at: string
}

type StoryGroup = {
  user_id: string
  full_name: string | null
  stories: Story[]
}

export default function StoriesRow() {
  const { user } = useAuth()
  const [groups, setGroups] = useState<StoryGroup[]>([])
  const [viewingGroup, setViewingGroup] = useState<StoryGroup | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('stories')
      .select('id, user_id, media_url, media_type, caption, created_at, profiles:user_id ( full_name )')
      .order('created_at', { ascending: true })

    if (!data) return

    const map = new Map<string, StoryGroup>()
    for (const row of data as any[]) {
      const uid = row.user_id
      if (!map.has(uid)) {
        map.set(uid, { user_id: uid, full_name: row.profiles?.full_name ?? null, stories: [] })
      }
      map.get(uid)!.stories.push({
        id: row.id,
        user_id: row.user_id,
        media_url: row.media_url,
        media_type: row.media_type,
        caption: row.caption,
        created_at: row.created_at,
      })
    }
    setGroups(Array.from(map.values()))
  }

  const myGroup = groups.find((g) => g.user_id === user?.id)
  const otherGroups = groups.filter((g) => g.user_id !== user?.id)

  return (
    <div className="flex gap-4 overflow-x-auto px-4 py-3 border-b border-stone-100 no-scrollbar">
      {/* Your Story */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
        {myGroup ? (
          <button onClick={() => setViewingGroup(myGroup)} className="flex flex-col items-center gap-1">
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-pink-500 p-[2.5px]">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-lg">
                🙂
              </div>
            </div>
            <span className="text-[10px] text-stone-600">Your Story</span>
          </button>
        ) : (
          <Link href={user ? '/story/upload' : '/login'} className="flex flex-col items-center gap-1">
            <div className="w-14 h-14 rounded-full bg-stone-100 border-2 border-dashed border-stone-300 flex items-center justify-center text-xl text-stone-400">
              +
            </div>
            <span className="text-[10px] text-stone-600">Add Story</span>
          </Link>
        )}
      </div>

      {/* Other users' stories */}
      {otherGroups.map((g) => (
        <button
          key={g.user_id}
          onClick={() => setViewingGroup(g)}
          className="flex flex-col items-center gap-1 flex-shrink-0 w-16"
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-pink-500 p-[2.5px]">
            <div className="w-full h-full rounded-full bg-stone-200 flex items-center justify-center text-sm font-bold text-stone-600">
              {g.full_name?.[0]?.toUpperCase() || '?'}
            </div>
          </div>
          <span className="text-[10px] text-stone-600 truncate w-full text-center">
            {g.full_name || 'User'}
          </span>
        </button>
      ))}

      {viewingGroup && (
        <StoryViewer group={viewingGroup} onClose={() => { setViewingGroup(null); load() }} />
      )}
    </div>
  )
}

function StoryViewer({ group, onClose }: { group: StoryGroup; onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const story = group.stories[index]

  useEffect(() => {
    if (!story) return
    if (story.media_type === 'image') {
      timerRef.current = setTimeout(next, 5000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [index, story])

  function next() {
    if (index < group.stories.length - 1) {
      setIndex(index + 1)
    } else {
      onClose()
    }
  }

  function prev() {
    if (index > 0) setIndex(index - 1)
  }

  if (!story) return null

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex gap-1 px-3 pt-3">
        {group.stories.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <div className={`h-full bg-white ${i < index ? 'w-full' : i === index ? 'w-full' : 'w-0'}`} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-white text-sm font-semibold">{group.full_name || 'User'}</span>
        <button onClick={onClose} className="text-white text-2xl leading-none px-2">×</button>
      </div>

      <div className="flex-1 flex items-center justify-center relative">
        <button onClick={prev} className="absolute left-0 top-0 bottom-0 w-1/3 z-10" aria-label="Previous" />
        <button onClick={next} className="absolute right-0 top-0 bottom-0 w-1/3 z-10" aria-label="Next" />

        {story.media_type === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={story.media_url} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <video src={story.media_url} autoPlay onEnded={next} className="max-h-full max-w-full object-contain" />
        )}
      </div>

      {story.caption && (
        <p className="text-white text-sm text-center px-6 pb-6">{story.caption}</p>
      )}
    </div>
  )
}
