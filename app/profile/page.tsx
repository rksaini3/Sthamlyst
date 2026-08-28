'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BadgeCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

type Person = {
  user_id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  is_verified: boolean
  i_follow_them?: boolean
}

export default function FollowersPage() {
  const params = useParams()
  const userId = params.userId as string
  const { user } = useAuth()
  const [tab, setTab] = useState<'followers' | 'following'>('followers')
  const [followers, setFollowers] = useState<Person[]>([])
  const [following, setFollowing] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function load() {
    setLoading(true)
    const [followersRes, followingRes] = await Promise.all([
      supabase.rpc('get_followers', { p_user_id: userId }),
      supabase.rpc('get_following', { p_user_id: userId }),
    ])
    if (followersRes.error) console.error('get_followers error:', followersRes.error)
    if (followingRes.error) console.error('get_following error:', followingRes.error)

    setFollowers((followersRes.data as Person[]) || [])
    setFollowing((followingRes.data as Person[]) || [])
    setLoading(false)
  }

  async function toggleFollow(targetId: string) {
    if (!user) return
    await supabase.rpc('toggle_follow', { p_target_user_id: targetId })
    load()
  }

  const list = tab === 'followers' ? followers : following

  return (
    <div className="max-w-md mx-auto pb-24 px-4 pt-6">
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/profile`}><ArrowLeft size={20} /></Link>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('followers')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold ${tab === 'followers' ? 'bg-clay text-white' : 'text-stone-500'}`}
          >
            Followers
          </button>
          <button
            onClick={() => setTab('following')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold ${tab === 'following' ? 'bg-clay text-white' : 'text-stone-500'}`}
          >
            Following
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-stone-400 text-sm pt-10">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-center text-stone-400 text-sm pt-10">
          {tab === 'followers' ? 'Koi followers nahi hain abhi.' : 'Abhi kisi ko follow nahi kiya.'}
        </p>
      ) : (
        <div className="space-y-3 mt-2">
          {list.map((person) => (
            <div key={person.user_id} className="flex items-center justify-between gap-3">
              <Link href={`/creator/${person.username || person.user_id}`} className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-stone-200 overflow-hidden flex-shrink-0">
                  {person.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={person.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-stone-400 text-white font-bold">
                      {(person.full_name || person.username || 'U')[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold text-stone-900 truncate">{person.full_name || 'User'}</span>
                    {person.is_verified && <BadgeCheck size={14} className="text-sky-500 fill-sky-500/20" />}
                  </div>
                  {person.username && <p className="text-xs text-stone-400">@{person.username}</p>}
                </div>
              </Link>

              {user && person.user_id !== user.id && (
                tab === 'followers' ? (
                  <button
                    onClick={() => toggleFollow(person.user_id)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 ${
                      person.i_follow_them ? 'bg-stone-100 text-stone-600' : 'bg-clay text-white'
                    }`}
                  >
                    {person.i_follow_them ? 'Following' : 'Follow Back'}
                  </button>
                ) : (
                  <button
                    onClick={() => toggleFollow(person.user_id)}
                    className="text-xs font-bold px-3 py-1.5 rounded-full bg-stone-100 text-stone-600 flex-shrink-0"
                  >
                    Remove
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
