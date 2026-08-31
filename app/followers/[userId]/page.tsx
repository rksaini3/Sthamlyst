'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BadgeCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

type PersonRow = { id: string; full_name: string | null; username: string | null; seller_verified: boolean }
type FollowStatus = 'none' | 'requested' | 'accepted'

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
  const [error, setError] = useState('')
  const [myFollowStatus, setMyFollowStatus] = useState<Record<string, FollowStatus>>({})

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId])

  async function load() {
    setLoading(true)
    setError('')
    setPeople([]) // clear stale data immediately so switching tabs never flashes the old list

    let peopleData: PersonRow[] = []

    if (tab === 'followers') {
      const { data, error: fetchError } = await supabase
        .from('follows')
        .select('follower_id, profiles:follower_id ( id, full_name, username, seller_verified )')
        .eq('following_id', userId)
        .eq('status', 'accepted') // only confirmed followers — a pending request is NOT a follower yet
      if (fetchError) {
        setError('List load nahi ho payi: ' + fetchError.message)
      } else {
        peopleData = ((data || []).map((d: any) => d.profiles).filter(Boolean)) as PersonRow[]
      }
    } else {
      const { data, error: fetchError } = await supabase
        .from('follows')
        .select('following_id, profiles:following_id ( id, full_name, username, seller_verified )')
        .eq('follower_id', userId)
        .eq('status', 'accepted')
      if (fetchError) {
        setError('List load nahi ho payi: ' + fetchError.message)
      } else {
        peopleData = ((data || []).map((d: any) => d.profiles).filter(Boolean)) as PersonRow[]
      }
    }

    setPeople(peopleData)

    if (user) {
      const { data: mine, error: mineError } = await supabase
        .from('follows')
        .select('following_id, status')
        .eq('follower_id', user.id)
      if (!mineError) {
        const statusMap: Record<string, FollowStatus> = {}
        ;(mine || []).forEach((f: any) => { statusMap[f.following_id] = f.status })
        setMyFollowStatus(statusMap)
      }
    }

    setLoading(false)
  }

  async function toggleFollow(targetId: string) {
    if (!user) { router.push('/login'); return }

    const { data, error: rpcError } = await supabase.rpc('toggle_follow', { p_target_user_id: targetId })
    if (rpcError) return

    // Use the RPC's actual returned status ('none' | 'requested' | 'accepted')
    // instead of guessing — a private account gives 'requested', not
    // an instant follow, and the button must reflect that correctly.
    setMyFollowStatus((prev) => ({ ...prev, [targetId]: (data as FollowStatus) ?? 'none' }))
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
        {error && <p className="text-center text-red-500 text-sm">{error}</p>}

        {people.map((p) => {
          const status = myFollowStatus[p.id] || 'none'
          const label = status === 'accepted' ? 'Following' : status === 'requested' ? 'Requested' : 'Follow'

          return (
            <div key={p.id} className="flex items-center gap-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-3">
              <div className="w-9 h-9 rounded-full bg-indigobrand-light flex items-center justify-center text-sm font-bold text-indigobrand">
                {p.full_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 flex items-center gap-1">
                  {p.full_name || 'Sthamly User'}
                  {p.seller_verified && <BadgeCheck size={13} className="text-mehendi fill-mehendi/20 flex-shrink-0" />}
                </p>
                {p.username && <p className="text-[11px] text-stone-400">@{p.username}</p>}
              </div>
              {user && p.id !== user.id && (
                <button
                  onClick={() => toggleFollow(p.id)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-full flex-shrink-0 ${
                    status === 'accepted' || status === 'requested' ? 'bg-stone-100 text-stone-600' : 'bg-indigobrand text-white'
                  }`}
                >
                  {label}
                </button>
              )}
            </div>
          )
        })}

        {!loading && !error && people.length === 0 && (
          <p className="text-center text-stone-400 text-sm pt-10">
            {tab === 'followers' ? 'Koi followers nahi hain abhi.' : 'Koi follow nahi kar rahe abhi.'}
          </p>
        )}
      </div>
    </div>
  )
}