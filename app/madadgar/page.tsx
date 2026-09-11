'use client'

import { useEffect, useRef, useState } from 'react'
import { HelpCircle, Mic, Send, Square } from 'lucide-react'

type Message = { role: 'user' | 'madadgar'; text: string }

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
}

export default function MadadgarPage() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'madadgar',
      text: 'नमस्ते! Main Sthamly Madadgar hoon. Aapko app istemal karne mein koi dikkat ho, jaise listing kaise banayein ya Deal Lock kya hai — bas poochh lijiye.',
    },
  ])
  const [thinking, setThinking] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(true)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setVoiceSupported(false)
      return
    }
    const recognition: SpeechRecognitionLike = new SpeechRecognition()
    recognition.lang = 'hi-IN'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setInput(transcript)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  function toggleVoice() {
    if (!recognitionRef.current) return
    if (listening) {
      recognitionRef.current.stop()
      setListening(false)
    } else {
      setInput('')
      recognitionRef.current.start()
      setListening(true)
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text) return
    const newHistory = [...messages, { role: 'user' as const, text }]
    setMessages(newHistory)
    setInput('')
    setThinking(true)

    try {
      const res = await fetch('/api/madadgar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: newHistory.map((m) => ({ role: m.role, text: m.text })),
        }),
      })
      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'madadgar', text: data.reply || 'Kuch gadbad ho gayi.' }])
    } catch {
      setMessages((prev) => [...prev, { role: 'madadgar', text: 'Network error — dobara try karo.' }])
    }
    setThinking(false)
  }

  return (
    <div className="max-w-md mx-auto h-[100dvh] flex flex-col pb-16 overflow-hidden">
      <div className="px-4 py-3 bg-violet-light border-b border-violet/20 flex items-center gap-2 shrink-0">
        <HelpCircle size={20} className="text-violet" />
        <div>
          <p className="text-sm font-bold text-violet">Sthamly Madadgar</p>
          <p className="text-[11px] text-violet/70">App istemal karne mein madad — type ya bolke pucho</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
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
        {thinking && <p className="text-xs text-stone-400">Madadgar soch raha hai…</p>}
        {listening && <p className="text-xs text-violet font-semibold">🎙️ Sun raha hoon… bolo</p>}
      </div>

      <div className="sticky bottom-0 z-50 bg-white px-4 pt-2 pb-3 border-t border-stone-100 shrink-0">
        <div className="flex items-center gap-2 bg-stone-50 rounded-full border border-stone-200 pl-4 pr-1.5 py-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="App ke baare mein pucho…"
            className="flex-1 bg-transparent text-sm outline-none min-w-0"
          />
          {voiceSupported && (
            <button
              onClick={toggleVoice}
              className={`p-2 rounded-full flex-shrink-0 ${listening ? 'bg-red-600 text-white' : 'text-violet'}`}
              aria-label="Voice input"
              type="button"
            >
              {listening ? <Square size={16} /> : <Mic size={18} />}
            </button>
          )}
          <button
            onClick={handleSend}
            disabled={thinking || !input.trim()}
            className="bg-violet text-white p-2.5 rounded-full flex-shrink-0 disabled:opacity-40"
            aria-label="Send"
            type="button"
          >
            <Send size={16} />
          </button>
        </div>
        {!voiceSupported && (
          <p className="text-[10px] text-stone-400 mt-1 text-center">
            Voice input is browser mein supported nahi hai — typing use karo.
          </p>
        )}
      </div>
    </div>
  )
}