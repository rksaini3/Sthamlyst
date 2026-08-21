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
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'social' | 'order'>('all')

  useEffect(() => {
    if (authLoading || !user) { setLoading(false); return }
    async function load() {
      const { data } = await supabase
        .from('notifications')
        .select('id, category, title, body, is_read, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setItems(data as Notification[])
      setLoading(false)
    }
    load()
  }, [authLoading, user])

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    await supabase.rpc('mark_notification_read', { p_id: id })
  }

  if (loading || authLoading) return <PageSkeleton rows={1} />

  const filtered = filter === 'all' ? items : items.filter((n) => n.category === filter)

  return (
    <div className="max-w-md mx-auto pb-24 px-4 pt-6 min-h-dvh">
      <h1 className="text-xl font-heading font-semibold text-stone-900">Notifications</h1>

      <div className="mt-3 flex gap-2 bg-stone-100 rounded-xl p-1">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${filter === 'all' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('social')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${filter === 'social' ? 'bg-white text-indigobrand shadow-sm' : 'text-stone-500'}`}
        >
          ग्राहकों के सवाल
        </button>
        <button
          onClick={() => setFilter('order')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${filter === 'order' ? 'bg-white text-mehendi shadow-sm' : 'text-stone-500'}`}
        >
          बाज़ार के ऑर्डर्स
        </button>
      </div>

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
        {items.length === 0 && (
          <p className="text-center text-stone-400 text-sm pt-10">No notifications yet.</p>
        )}
      </div>
    </div>
  )
}
