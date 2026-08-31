'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'
import PageSkeleton from '@/components/PageSkeleton'

type Notification = {
  id: string
  category: 'reward' | 'order' | 'social' | 'learning'
  title: string
  body: string | null
  is_read: boolean
  created_at: string
}

type FollowRequest = {
  follower_id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
}

const CATEGORY_ICON: Record<string, string> = {
  reward: '🪙',
  order: '📦',
  social: '💬',
  learning: '📚',
}

const CATEGORY_COLOR: Record<string, string> = {
  reward: 'bg-turmeric-light text-turmeric',
  order: 'bg-mehendi-light text-mehendi',
  social: 'bg-indigobrand-light text-indigobrand',
  learning: 'bg-violet-light text-violet',
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'social' | 'order' | 'requests'>('all')

  useEffect(() => {
    if (authLoading || !user) { setLoading(false); return }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user])

  async function load() {
    if (!user) return
    setLoadError('')
    const [notifRes, reqRes] = await Promise.all([
      supabase
        .from('notifications')
        .select('id, category, title, body, is_read, created_at')
        .eq('user_id', user.id) // explicit filter — never rely on RLS alone
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.rpc('get_pending_follow_requests'),
    ])

    if (notifRes.error || reqRes.error) {
      setLoadError('Notifications load nahi ho payin. Refresh karke try karo.')
    }
    if (notifRes.data) setItems(notifRes.data as Notification[])
    if (reqRes.data) setFollowRequests(reqRes.data as FollowRequest[])
    setLoading(false)
  }

  async function markRead(id: string) {
    const prevItems = items
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))

    const { error } = await supabase.rpc('mark_notification_read', { p_id: id })
    if (error) {
      setItems(prevItems) // rollback on failure
    }
  }

  async function acceptRequest(followerId: string) {
    if (pendingAction) return
    setActionError('')
    setPendingAction(followerId)
    const { error } = await supabase.rpc('accept_follow_request', { p_follower_id: followerId })
    setPendingAction(null)

    if (error) {
      setActionError('Accept nahi ho paya: ' + error.message)
      return
    }
    setFollowRequests((prev) => prev.filter((r) => r.follower_id !== followerId))
  }

  async function rejectRequest(followerId: string) {
    if (pendingAction) return
    setActionError('')
    setPendingAction(followerId)
    const { error } = await supabase.rpc('reject_follow_request', { p_follower_id: followerId })
    setPendingAction(null)

    if (error) {
      setActionError('Reject nahi ho paya: ' + error.message)
      return
    }
    setFollowRequests((prev) => prev.filter((r) => r.follower_id !== followerId))
  }

  if (loading || authLoading) return <PageSkeleton rows={1} />

  const filtered = filter === 'all' ? items : filter === 'requests' ? [] : items.filter((n) => n.category === filter)

  return (
    <div className="max-w-md mx-auto pb-24 px-4 pt-6 min-h-dvh">
      <h1 className="text-xl font-heading font-semibold text-stone-900">Notifications</h1>

      <div className="mt-3 flex gap-2 bg-stone-100 rounded-xl p-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setFilter('all')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${filter === 'all' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('requests')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1 ${filter === 'requests' ? 'bg-white text-clay shadow-sm' : 'text-stone-500'}`}
        >
          Requests
          {followRequests.length > 0 && (
            <span className="bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
              {followRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter('social')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${filter === 'social' ? 'bg-white text-indigobrand shadow-sm' : 'text-stone-500'}`}
        >
          ग्राहकों के सवाल
        </button>
        <button
          onClick={() => setFilter('order')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${filter === 'order' ? 'bg-white text-mehendi shadow-sm' : 'text-stone-500'}`}
        >
          बाज़ार के ऑर्डर्स
        </button>
      </div>

      {loadError && <p className="text-center text-red-500 text-xs mt-3">{loadError}</p>}
      {actionError && <p className="text-center text-red-500 text-xs mt-3">{actionError}</p>}

      {filter === 'requests' ? (
        <div className="mt-4 space-y-3">
          {followRequests.length === 0 ? (
            <p className="text-center text-stone-400 text-sm pt-10">Koi pending follow request nahi hai.</p>
          ) : (
            followRequests.map((r) => (
              <div key={r.follower_id} className="flex items-center justify-between gap-3 bg-white border border-stone-200 rounded-xl p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-stone-200 overflow-hidden flex-shrink-0">
                    {r.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-stone-400 text-white font-bold text-sm">
                        {(r.full_name || r.username || 'U')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900 truncate">{r.full_name || 'User'}</p>
                    <p className="text-xs text-stone-400">
                      {r.username ? `@${r.username} ` : ''}aapko follow karna chahte hain
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => acceptRequest(r.follower_id)}
                    disabled={pendingAction === r.follower_id}
                    className="text-xs font-bold px-3 py-1.5 rounded-full bg-clay text-white disabled:opacity-50"
                  >
                    {pendingAction === r.follower_id ? '...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => rejectRequest(r.follower_id)}
                    disabled={pendingAction === r.follower_id}
                    className="text-xs font-bold px-3 py-1.5 rounded-full bg-stone-100 text-stone-600 disabled:opacity-50"
                  >
                    {pendingAction === r.follower_id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.is_read && markRead(n.id)}
              className={`w-full text-left flex items-start gap-3 rounded-xl p-3 border ${
                n.is_read ? 'bg-white border-stone-200' : 'bg-amber-50 border-amber-200'
              }`}
            >
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${CATEGORY_COLOR[n.category]}`}>
                {CATEGORY_ICON[n.category]}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-800">{n.title}</p>
                {n.body && <p className="text-xs text-stone-500 mt-0.5">{n.body}</p>}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-stone-400 text-sm pt-10">No notifications yet.</p>
          )}
        </div>
      )}
    </div>
  )
}