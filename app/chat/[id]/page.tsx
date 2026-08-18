'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Message = {
  id: string
  sender_id: string
  body: string | null
  offer_price: number | null
  created_at: string
}

export default function ChatThreadPage() {
  const params = useParams()
  const conversationId = params.id as string

  const [messages, setMessages] = useState<Message[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [offer, setOffer] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      if (userData?.user) setMyId(userData.user.id)

      const { data } = await supabase
        .from('messages')
        .select('id, sender_id, body, offer_price, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (data) setMessages(data as Message[])
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!text.trim() && !offer) return
    await supabase.rpc('send_message', {
      p_conversation_id: conversationId,
      p_body: text.trim() || null,
      p_offer_price: offer ? Number(offer) : null,
    })
    setText('')
    setOffer('')
  }

  if (loading) return <div className="p-6 text-center text-stone-500">Loading chat…</div>

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col pb-4">
      <header className="sticky top-0 bg-amber-50/95 backdrop-blur px-4 py-3 border-b border-amber-100 z-10">
        <h1 className="text-sm font-bold text-amber-900">Chat to Bargain</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.map((m) => {
          const isMine = m.sender_id === myId
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  isMine ? 'bg-amber-600 text-white' : 'bg-white border border-stone-200 text-stone-800'
                }`}
              >
                {m.offer_price != null && (
                  <p className={`text-xs font-bold mb-0.5 ${isMine ? 'text-amber-100' : 'text-amber-700'}`}>
                    💰 Offer: ₹{m.offer_price}
                  </p>
                )}
                {m.body && <p>{m.body}</p>}
              </div>
            </div>
          )
        })}
        {messages.length === 0 && (
          <p className="text-center text-stone-400 text-sm pt-10">Say hello and start bargaining!</p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pt-2 border-t border-stone-100">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-stone-500">₹</span>
          <input
            type="number"
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
            placeholder="Make a price offer (optional)"
            className="flex-1 border border-stone-300 rounded-lg px-2 py-1.5 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message…"
            className="flex-1 border border-stone-300 rounded-full px-4 py-2 text-sm"
          />
          <button
            onClick={sendMessage}
            className="bg-amber-600 text-white font-semibold px-4 py-2 rounded-full text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
