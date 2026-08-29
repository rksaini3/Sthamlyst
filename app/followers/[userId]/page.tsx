'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

type PersonRow = { id: string; full_name: string | null; username: string | null; seller_verified: boolean }

export default function FollowersPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const userId = params.userId as string
  const initialTab = searchParams.get('mode') === 'following' ? 'following' : 'followers'
  const [tab, setTab] = useState<'followers' | 'following'>(initialTab)
  const [people, setPeople] = useState<PersonRow[]>([])
  const [loading, setLoading] = useState(true)
  const [myFollows, setMyFollows] = useState<Set<string>>(new Set())

  useEffect(() => {
    load()
  }, [tab, userId])

  async function load() {
    setLoading(true)
    if (tab === 'followers') {
      const { data } = await supabase
        .from('follows')
        .select('follower_id, profiles:follower_id ( id, full_name, username, seller_verified )')
        .eq('following_id', userId)
      setPeople(((data || []).map((d: any) => d.profiles).filter(Boolean)) as PersonRow[])
    } else {
      const { data } = await supabase
        .from('follows')
        .select('following_id, profiles:following_id ( id, full_name, username, seller_verified )')
        .eq('follower_id', userId)
      setPeople(((data || []).map((d: any) => d.profiles).filter(Boolean)) as PersonRow[])
    }

    if (user) {
      const { data: mine } = await supabase.from('follows').select('following_id').eq('follower_id', user.id)
      setMyFollows(new Set((mine || []).map((f: any) => f.following_id)))
    }
    setLoading(false)
  }

  async function toggleFollow(targetId: string) {
    if (!user) { router.push('/login'); return }
    const nowFollowing = !myFollows.has(targetId)
    setMyFollows((prev) => {
      const next = new Set(prev)
      nowFollowing ? next.add(targetId) : next.delete(targetId)
      return next
    })
    await supabase.rpc('toggle_follow', { p_target_user_id: targetId })
  }

  return (
    <div className="max-w-md mx-auto pb-24 min-h-dvh">
      <header className="sticky top-0 bg-white dark:bg-stone-900 px-4 py-3 border-b border-stone-100 dark:border-stone-800 z-10 flex items-center gap-3">
        <Link href="/"><ArrowLeft size={22} className="text-stone-800 dark:text-stone-200" /></Link>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('followers')}
            className={`text-sm font-semibold px-3 py-1 rounded-full ${tab === 'followers' ? 'bg-clay text-white' : 'text-stone-500'}`}
          >
            Followers
          </button>
          <button
            onClick={() => setTab('following')}
            className={`text-sm font-semibold px-3 py-1 rounded-full ${tab === 'following' ? 'bg-clay text-white' : 'text-stone-500'}`}
          >
            Following
          </button>
        </div>
      </header>

      <div className="px-4 pt-3 space-y-2">
        {loading && <p className="text-center text-stone-400 text-sm">Loading…</p>}
        {people.map((p) => (
          <div key={p.id} className="flex items-center gap-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-3">
            <div className="w-9 h-9 rounded-full bg-indigobrand-light flex items-center justify-center text-sm font-bold text-indigobrand">
              {p.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                {p.full_name || 'Sthamly User'}
                {p.seller_verified && <span className="text-mehendi ml-1">✓</span>}
              </p>
              {p.username && <p className="text-[11px] text-stone-400">@{p.username}</p>}
            </div>
            {user && p.id !== user.id && (
              <button
                onClick={() => toggleFollow(p.id)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-full flex-shrink-0 ${
                  myFollows.has(p.id) ? 'bg-stone-100 text-stone-600' : 'bg-indigobrand text-white'
                }`}
              >
                {myFollows.has(p.id) ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        ))}
        {!loading && people.length === 0 && (
          <p className="text-center text-stone-400 text-sm pt-10">
            {tab === 'followers' ? 'Koi followers nahi hain abhi.' : 'Koi follow nahi kar rahe abhi.'}
          </p>
        )}
      </div>
    </div>
  )
}
