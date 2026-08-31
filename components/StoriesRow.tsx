'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'
import StoryViewer from '@/components/StoryViewer'

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
  avatar_url: string | null
  stories: Story[]
}

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000

export default function StoriesRow() {
  const { user } = useAuth()
  const [groups, setGroups] = useState<StoryGroup[]>([])
  // Index into `orderedGroups` (below) of the group currently being
  // viewed — null means the viewer is closed.
  const [viewerStartIndex, setViewerStartIndex] = useState<number | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    // Only fetch stories from the last 24 hours — a real Stories feature
    // is expected to expire, not accumulate forever.
    const since = new Date(Date.now() - STORY_LIFETIME_MS).toISOString()

    const { data, error } = await supabase
      .from('stories')
      .select('id, user_id, media_url, media_type, caption, created_at, profiles:user_id ( full_name, avatar_url )')
      .gte('created_at', since)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('stories fetch failed:', error)
      return
    }
    if (!data) return

    const map = new Map<string, StoryGroup>()
    for (const row of data as any[]) {
      const uid = row.user_id
      if (!map.has(uid)) {
        map.set(uid, {
          user_id: uid,
          full_name: row.profiles?.full_name ?? null,
          avatar_url: row.profiles?.avatar_url ?? null,
          stories: [],
        })
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

  // Single ordered list (mine first, then everyone else's) — this is
  // what gets handed to the shared StoryViewer, so that once you finish
  // your own stories (or anyone's), it can keep auto-advancing into the
  // next person's stories instead of stopping after just one group.
  const orderedGroups = [...(myGroup ? [myGroup] : []), ...otherGroups]

  // Map our local shape into the shape StoryViewer expects.
  const viewerGroups = orderedGroups.map((g) => ({
    user_id: g.user_id,
    user: { full_name: g.full_name, avatar_url: g.avatar_url },
    items: g.stories.map((s) => ({
      media_type: s.media_type,
      media_url: s.media_url,
      caption: s.caption,
    })),
  }))

  return (
    <div className="flex gap-4 overflow-x-auto px-4 py-3 border-b border-stone-100 dark:border-stone-800 no-scrollbar">
      {/* Add Story — always first (leftmost) */}
      <Link
        href={user ? '/story/upload' : '/login'}
        className="flex flex-col items-center gap-1 flex-shrink-0 w-16"
      >
        <div className="w-14 h-14 rounded-full bg-stone-100 dark:bg-stone-800 border-2 border-dashed border-stone-300 dark:border-stone-600 flex items-center justify-center">
          <span className="text-2xl text-amber-600 leading-none">+</span>
        </div>
        <span className="text-[10px] text-stone-600 dark:text-stone-400">Add Story</span>
      </Link>

      {/* Your Story — only shown if a story already exists, tap to VIEW it */}
      {myGroup && (
        <button
          onClick={() => setViewerStartIndex(0)}
          className="flex flex-col items-center gap-1 flex-shrink-0 w-16"
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-pink-500 p-[2.5px]">
            <div className="w-full h-full rounded-full bg-white dark:bg-stone-900 overflow-hidden flex items-center justify-center text-sm font-bold text-stone-600 dark:text-stone-300">
              {myGroup.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={myGroup.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                myGroup.full_name?.[0]?.toUpperCase() || ''
              )}
            </div>
          </div>
          <span className="text-[10px] text-stone-600 dark:text-stone-400">Your Story</span>
        </button>
      )}

      {/* Other users' stories */}
      {otherGroups.map((g, i) => (
        <button
          key={g.user_id}
          onClick={() => setViewerStartIndex((myGroup ? 1 : 0) + i)}
          className="flex flex-col items-center gap-1 flex-shrink-0 w-16"
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-pink-500 p-[2.5px]">
            <div className="w-full h-full rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden flex items-center justify-center text-sm font-bold text-stone-600 dark:text-stone-300">
              {g.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                g.full_name?.[0]?.toUpperCase() || '?'
              )}
            </div>
          </div>
          <span className="text-[10px] text-stone-600 dark:text-stone-400 truncate w-full text-center">
            {g.full_name || 'User'}
          </span>
        </button>
      ))}

      {viewerStartIndex !== null && (
        <StoryViewer
          groups={viewerGroups}
          startIndex={viewerStartIndex}
          onClose={() => { setViewerStartIndex(null); load() }}
        />
      )}
    </div>
  )
}
