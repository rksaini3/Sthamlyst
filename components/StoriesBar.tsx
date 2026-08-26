'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'
import StoryViewer from './StoryViewer'

type StoryGroup = {
  user_id: string
  user: { full_name: string | null; avatar_url: string | null } | null
  items: any[]
}

export default function StoryBar() {
  const { user } = useAuth()
  const router = useRouter()
  const [groups, setGroups] = useState<StoryGroup[]>([])
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  useEffect(() => {
    loadStories()
  }, [])

  async function loadStories() {
    const { data, error } = await supabase
      .from('stories')
      .select('id, user_id, media_url, media_type, caption, created_at, expires_at, profiles(full_name, avatar_url)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error || !data) return

    const grouped: Record<string, StoryGroup> = {}
    for (const s of data as any[]) {
      if (!grouped[s.user_id]) {
        grouped[s.user_id] = { user_id: s.user_id, user: s.profiles, items: [] }
      }
      grouped[s.user_id].items.push(s)
    }
    setGroups(Object.values(grouped))
  }

  function handleAddStory() {
    if (!user) {
      router.push('/login')
      return
    }
    router.push('/story/upload')
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto px-4 py-3 no-scrollbar">
        {/* Your Story / Add button */}
        <button onClick={handleAddStory} className="flex flex-col items-center gap-1 flex-none w-16">
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-stone-300 flex items-center justify-center relative overflow-hidden">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl text-stone-400">+</span>
            )}
          </div>
          <span className="text-[11px] text-stone-600 truncate w-16 text-center">Your Story</span>
        </button>

        {/* Other users' stories */}
        {groups.map((g, i) => (
          <button
            key={g.user_id}
            onClick={() => setViewerIndex(i)}
            className="flex flex-col items-center gap-1 flex-none w-16"
          >
            <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-amber-500 via-rose-500 to-amber-600">
              <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center">
                {g.user?.avatar_url ? (
                  <img src={g.user.avatar_url} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-amber-700">
                    {(g.user?.full_name?.[0] ?? '?').toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <span className="text-[11px] text-stone-600 truncate w-16 text-center">
              {g.user?.full_name ?? 'User'}
            </span>
          </button>
        ))}
      </div>

      {viewerIndex !== null && (
        <StoryViewer
          groups={groups}
          startIndex={viewerIndex}
          onClose={() => {
            setViewerIndex(null)
            loadStories() // refresh in case some expired while viewing
          }}
        />
      )}
    </>
  )
}