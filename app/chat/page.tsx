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
  products: { title: string; image_url: string | null } | null
}

export default function ChatInboxPage() {
  const { user, loading: authLoading } = useAuth()
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    async function load() {
      const { data } = await supabase
        .from('conversations')
        .select('id, buyer_id, seller_id, product_id, updated_at, products ( title, image_url )')
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
      <div className="max-w-md mx-auto min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl mb-3">💬</p>
        <h1 className="text-lg font-bold text-stone-900">Sign in to see your chats</h1>
        <Link href="/login" className="mt-4 bg-amber-600 text-white font-semibold py-3 px-6 rounded-xl text-sm">
          Sign In
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto pb-24 px-4 pt-6">
      <h1 className="text-xl font-bold text-amber-900">Chats</h1>
      <p className="text-xs text-stone-500 mt-1">Bargain directly with buyers &amp; sellers</p>

      <div className="mt-4 space-y-2">
        {conversations.map((c) => (
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
          </Link>
        ))}
        {conversations.length === 0 && (
          <p className="text-center text-stone-400 pt-10 text-sm">
            No chats yet. Tap &quot;Chat to Bargain&quot; on any product in the Bazaar.
          </p>
        )}
      </div>
    </div>
  )
}
