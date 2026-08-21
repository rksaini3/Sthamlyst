'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'

type Message = { role: 'user' | 'sahayak'; text: string }

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
    const newHistory = [...messages, { role: 'user' as const, text }]
    setMessages(newHistory)
    setInput('')
    setThinking(true)

    try {
      const res = await fetch('/api/sahayak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: newHistory.map((m) => ({ role: m.role, text: m.text })),
        }),
      })
      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'sahayak', text: data.reply || 'Kuch gadbad ho gayi.' }])
    } catch {
      setMessages((prev) => [...prev, { role: 'sahayak', text: 'Network error — dobara try karo.' }])
    }
    setThinking(false)
  }

  return (
    <div className="max-w-md mx-auto min-h-dvh flex flex-col pb-4">
      <div className="px-4 py-3 bg-violet-light border-b border-violet/20 flex items-center gap-2">
        <Sparkles size={20} className="text-violet" />
        <div>
          <p className="text-sm font-bold text-violet">Sthamly Sahayak</p>
          <p className="text-[11px] text-violet/70">Gemini AI se powered — type for now, voice coming later</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-clay text-white' : 'bg-violet-light text-stone-800'
              }`}
            >
              {m.text}
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
        <button onClick={handleSend} disabled={thinking} className="bg-violet text-white font-semibold px-4 py-2 rounded-full text-sm disabled:opacity-50">
          Bhejo
        </button>
      </div>
    </div>
  )
}
