'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

type ConversationRow = {
  id: string
  buyer_id: string
  seller_id: string
  product_id: string | null
  updated_at: string
  deal_status: 'active' | 'completed'
  products: { title: string; image_url: string | null } | null
}

export default function ChatInboxPage() {
  const { user, loading: authLoading } = useAuth()
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'completed'>('active')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    async function load() {
      const { data } = await supabase
        .from('conversations')
        .select('id, buyer_id, seller_id, product_id, updated_at, deal_status, products ( title, image_url )')
        .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`)
        .order('updated_at', { ascending: false })

      if (data) setConversations(data as unknown as ConversationRow[])
      setLoading(false)
    }
    load()
  }, [authLoading, user])

  if (loading || authLoading) return <div className="p-6 text-center text-stone-500">Loading chats…</div>

  if (!user) {
    return (
      <div className="max-w-md mx-auto min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl mb-3">💬</p>
        <h1 className="text-lg font-bold text-stone-900">Sign in to see your chats</h1>
        <Link href="/login" className="mt-4 bg-clay text-white font-semibold py-3 px-6 rounded-xl text-sm">
          Sign In
        </Link>
      </div>
    )
  }

  const filtered = conversations.filter((c) => c.deal_status === filter)

  return (
    <div className="max-w-md mx-auto pb-24 px-4 pt-6">
      <h1 className="text-xl font-heading font-semibold text-clay">Chats</h1>
      <p className="text-xs text-stone-500 mt-1">Bargain directly with buyers &amp; sellers</p>

      <div className="mt-3 flex gap-2 bg-stone-100 rounded-xl p-1">
        <button
          onClick={() => setFilter('active')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${
            filter === 'active' ? 'bg-white text-clay shadow-sm' : 'text-stone-500'
          }`}
        >
          सक्रिय मोल-भाव
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${
            filter === 'completed' ? 'bg-white text-mehendi shadow-sm' : 'text-stone-500'
          }`}
        >
          सफल सौदे
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {filtered.map((c) => (
          <Link
            key={c.id}
            href={`/chat/${c.id}`}
            className="flex items-center gap-3 bg-white border border-stone-200 rounded-xl p-3"
          >
            {c.products?.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.products.image_url} alt="" className="w-11 h-11 rounded-lg object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-800 truncate">
                {c.products?.title || 'General chat'}
              </p>
              <p className="text-[11px] text-stone-400">
                {c.buyer_id === user.id ? 'You are the buyer' : 'You are the seller'}
              </p>
            </div>
            {c.deal_status === 'completed' && (
              <span className="text-[10px] font-bold text-mehendi bg-mehendi-light px-2 py-0.5 rounded-full">
                ✓ Done
              </span>
            )}
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-stone-400 pt-10 text-sm">
            {filter === 'active'
              ? 'No active bargains yet. Tap "Chat to Bargain" on any product in the Bazaar.'
              : 'No completed deals yet.'}
          </p>
        )}
      </div>
    </div>
  )
}
