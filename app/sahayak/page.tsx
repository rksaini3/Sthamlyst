'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Message = { role: 'user' | 'sahayak'; text: string; links?: { label: string; href: string }[] }

export default function SahayakPage() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'sahayak',
      text: 'नमस्ते! Main Sthamly Sahayak hoon. Mujhse products, services, ya reels ke baare mein pucho — jaise "mujhe clay diya dikhao" ya "photography wale creator dikhao".',
    },
  ])
  const [thinking, setThinking] = useState(false)

  async function handleSend() {
    const text = input.trim()
    if (!text) return
    setMessages((prev) => [...prev, { role: 'user', text }])
    setInput('')
    setThinking(true)

    // Foundation version: keyword search across products/services/lessons.
    // This is not yet a true reasoning AI — real multi-turn understanding
    // and voice input are a later phase (see Sahayak Part 2 in the plan).
    const q = `%${text}%`
    const [productRes, lessonRes] = await Promise.all([
      supabase.from('products').select('id, title, price, is_service').eq('is_active', true).ilike('title', q).limit(5),
      supabase.from('lessons').select('id, title').eq('is_published', true).ilike('title', q).limit(5),
    ])

    const products = productRes.data || []
    const lessons = lessonRes.data || []

    let reply = ''
    const links: { label: string; href: string }[] = []

    if (products.length > 0) {
      reply += `Mujhe Bazaar mein ${products.length} cheez milin: ` + products.map((p: any) => p.title).join(', ') + '. '
      links.push({ label: 'Open Bazaar', href: '/bazaar' })
    }
    if (lessons.length > 0) {
      reply += `Aur ${lessons.length} reels mile: ` + lessons.map((l: any) => l.title).join(', ') + '. '
      links.push({ label: 'Open Feed', href: '/' })
    }
    if (!reply) {
      reply = 'Mujhe kuch match nahi mila. Thoda alag tarike se try karo, ya seedhe Search page use karo.'
      links.push({ label: 'Open Search', href: '/search' })
    }

    setMessages((prev) => [...prev, { role: 'sahayak', text: reply, links }])
    setThinking(false)
  }

  return (
    <div className="max-w-md mx-auto min-h-dvh flex flex-col pb-4">
      <div className="px-4 py-3 bg-violet-light border-b border-violet/20 flex items-center gap-2">
        <Sparkles size={20} className="text-violet" />
        <div>
          <p className="text-sm font-bold text-violet">Sthamly Sahayak</p>
          <p className="text-[11px] text-violet/70">Foundation version — type for now, voice coming later</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                m.role === 'user' ? 'bg-clay text-white' : 'bg-violet-light text-stone-800'
              }`}
            >
              <p>{m.text}</p>
              {m.links && m.links.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {m.links.map((l) => (
                    <Link key={l.href} href={l.href} className="text-xs font-semibold underline text-violet">
                      {l.label} →
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {thinking && <p className="text-xs text-stone-400">Sahayak soch raha hai…</p>}
      </div>

      <div className="px-4 pt-2 border-t border-stone-100 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Kuch bhi pucho…"
          className="flex-1 border border-stone-300 rounded-full px-4 py-2 text-sm"
        />
        <button onClick={handleSend} className="bg-violet text-white font-semibold px-4 py-2 rounded-full text-sm">
          Bhejo
        </button>
      </div>
    </div>
  )
}
