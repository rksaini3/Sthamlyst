'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BadgeCheck, Play, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

type PublicProfile = {
  id: string
  full_name: string | null
  username: string | null
  bio: string | null
  city: string | null
  avatar_url: string | null
  is_verified: boolean
  is_private: boolean
  followers_count: number
  following_count: number
  posts_count: number
  my_follow_status: 'none' | 'requested' | 'accepted'
  follows_me: boolean
}

type ContentTab = 'reels' | 'products'
type GridItem = { id: string; title: string; image_url: string | null }

function contentHref(tab: ContentTab, id: string) {
  return tab === 'products' ? `/product/${id}` : `/reel/${id}`
}

export default function CreatorProfilePage() {
  const params = useParams()
  const handle = (params?.handle as string) || ''
  const { user } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [debugError, setDebugError] = useState('')
  const [followBusy, setFollowBusy] = useState(false)
  const [contentTab, setContentTab] = useState<ContentTab>('reels')

  useEffect(() => {
    if (!handle) {
      setNotFound(true)
      setLoading(false)
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle])

  useEffect(() => {
    if (profile?.id) {
      supabase.rpc('log_profile_view', { p_profile_id: profile.id, p_source: 'profile' }).then(
        () => {},
        (err) => console.error('log_profile_view failed:', err)
      )
    }
  }, [profile?.id])

  async function load() {
    setLoading(true)
    setNotFound(false)
    setDebugError('')
    try {
      const { data, error } = await supabase.rpc('get_public_profile', { p_username: handle })
      if (error) {
        setDebugError(error.message)
        setNotFound(true)
      } else if (!data) {
        setNotFound(true)
      } else {
        setProfile(data as PublicProfile)
      }
    } catch (err: any) {
      setDebugError(err?.message || 'Unknown error')
      setNotFound(true)
    }
    setLoading(false)
  }

  async function toggleFollow() {
    if (!user) {
      router.push('/login')
      return
    }
    if (!profile) return
    setFollowBusy(true)
    const { error } = await supabase.rpc('toggle_follow', { p_target_user_id: profile.id })
    setFollowBusy(false)
    if (!error) load()
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto pb-24 px-4 pt-6">
        <button onClick={() => router.back()} className="mb-4"><ArrowLeft size={20} /></button>
        <p className="text-center text-stone-400 text-sm pt-16">Loading…</p>
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="max-w-md mx-auto pb-24 px-4 pt-6 text-center">
        <button onClick={() => router.back()} className="mb-4"><ArrowLeft size={20} /></button>
        <p className="text-4xl mb-3">🔍</p>
        <p className="text-stone-500 text-sm">Yeh creator nahi mila.</p>
        {debugError && (
          <p className="text-[11px] text-red-500 mt-4 max-w-xs mx-auto break-words">Debug: {debugError}</p>
        )}
      </div>
    )
  }

  const isMe = user?.id === profile.id
  const canSeeContent = isMe || !profile.is_private || profile.my_follow_status === 'accepted'

  const followLabel =
    profile.my_follow_status === 'accepted' ? 'Following' :
    profile.my_follow_status === 'requested' ? 'Requested' :
    profile.follows_me ? 'Follow Back' : 'Follow'

  return (
    <div className="max-w-md mx-auto pb-24 px-4 pt-6">
      <button onClick={() => router.back()} className="mb-4 text-stone-600 dark:text-stone-300"><ArrowLeft size={20} /></button>

      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-indigobrand-light overflow-hidden flex-shrink-0">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-indigobrand">
              {(profile.full_name || profile.username || 'U')[0].toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg font-bold text-amber-900">{profile.full_name || 'Creator'}</h1>
            {profile.is_verified && <BadgeCheck size={16} className="text-sky-500 fill-sky-500/20" />}
          </div>
          {profile.username && <p className="text-sm text-stone-400">@{profile.username}</p>}
          {profile.city && <p className="text-xs text-stone-500">{profile.city}</p>}
        </div>
      </div>

      {profile.bio && <p className="text-sm text-stone-700 dark:text-stone-300 mt-3">{profile.bio}</p>}

      {/* Same stat-row style as /profile — Posts/Followers/Following in one line */}
      <div className="flex items-center mt-5 divide-x divide-stone-200 dark:divide-stone-700 border-y border-stone-200 dark:border-stone-700 py-3">
        <div className="flex-1 text-center">
          <p className="text-base font-bold text-stone-900 dark:text-stone-100">{profile.posts_count}</p>
          <p className="text-[11px] text-stone-500">Posts</p>
        </div>
        <Link href={`/followers/${profile.id}?mode=followers`} className="flex-1 text-center">
          <p className="text-base font-bold text-stone-900 dark:text-stone-100">{profile.followers_count}</p>
          <p className="text-[11px] text-stone-500">Followers</p>
        </Link>
        <Link href={`/followers/${profile.id}?mode=following`} className="flex-1 text-center">
          <p className="text-base font-bold text-stone-900 dark:text-stone-100">{profile.following_count}</p>
          <p className="text-[11px] text-stone-500">Following</p>
        </Link>
      </div>

      {!isMe ? (
        <button
          onClick={toggleFollow}
          disabled={followBusy}
          className={`mt-4 w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 ${
            profile.my_follow_status === 'accepted' || profile.my_follow_status === 'requested'
              ? 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
              : 'bg-clay text-white'
          }`}
        >
          {followBusy ? 'Ek second…' : followLabel}
        </button>
      ) : (
        <Link href="/profile" className="mt-4 block text-center w-full py-2.5 rounded-xl text-sm font-bold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
          Edit Your Profile
        </Link>
      )}

      {/* Same Reels/Products grid as /profile, so a creator's public page
          isn't just a name card — people can actually see their work here. */}
      <div className="mt-8">
        {!canSeeContent ? (
          <div className="flex flex-col items-center justify-center py-14 text-center border-t border-stone-200 dark:border-stone-700">
            <Lock size={28} className="text-stone-400 mb-2" />
            <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">This account is private</p>
            <p className="text-xs text-stone-400 mt-1">Follow to see their reels and products.</p>
          </div>
        ) : (
          <>
            <div className="flex gap-1 border-b border-stone-200 dark:border-stone-700">
              <button
                onClick={() => setContentTab('reels')}
                className={`flex-1 text-center text-xs font-semibold py-2.5 border-b-2 ${contentTab === 'reels' ? 'border-clay text-clay' : 'border-transparent text-stone-400'}`}
              >
                Reels
              </button>
              <button
                onClick={() => setContentTab('products')}
                className={`flex-1 text-center text-xs font-semibold py-2.5 border-b-2 ${contentTab === 'products' ? 'border-clay text-clay' : 'border-transparent text-stone-400'}`}
              >
                Products
              </button>
            </div>
            <CreatorContentGrid tab={contentTab} userId={profile.id} />
          </>
        )}
      </div>
    </div>
  )
}

function CreatorContentGrid({ tab, userId }: { tab: ContentTab; userId: string }) {
  const [items, setItems] = useState<GridItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId])

  async function load() {
    setLoading(true)
    if (tab === 'reels') {
      const { data } = await supabase.from('lessons').select('id, title, video_url').eq('creator_id', userId).eq('is_user_generated', true).order('created_at', { ascending: false })
      setItems((data || []).map((d: any) => ({ id: d.id, title: d.title, image_url: d.video_url })))
    } else {
      const { data } = await supabase.from('products').select('id, title, image_url').eq('maker_id', userId).order('created_at', { ascending: false })
      setItems((data || []) as GridItem[])
    }
    setLoading(false)
  }

  if (loading) return <p className="text-center text-stone-400 text-xs py-8">Loading…</p>
  if (items.length === 0) return <p className="text-center text-stone-400 text-xs py-8">Kuch nahi hai yahan abhi.</p>

  return (
    <div className="grid grid-cols-3 gap-0.5 mt-3">
      {items.map((item) => {
        const isVideo = tab === 'reels' && !!item.image_url
        return (
          <Link key={item.id} href={contentHref(tab, item.id)} className="relative aspect-square bg-stone-100 overflow-hidden">
            {item.image_url && !isVideo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image_url} alt="" className="w-full h-full object-cover" />
            ) : item.image_url ? (
              <>
                <video src={item.image_url} className="w-full h-full object-cover" muted />
                <Play size={16} className="absolute top-1.5 right-1.5 text-white drop-shadow" fill="white" />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-stone-400 p-1 text-center">{item.title}</div>
            )}
          </Link>
        )
      })}
    </div>
  )
}
