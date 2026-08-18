'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'
import { ArrowLeft, Camera, Image as ImageIcon, Mic, Send, Square } from 'lucide-react'

type Message = {
  id: string
  sender_id: string
  body: string | null
  offer_price: number | null
  image_url: string | null
  audio_url: string | null
  created_at: string
}

type OtherUser = { id: string; full_name: string | null; seller_verified: boolean }
type ProductInfo = { title: string; price: number; image_url: string | null }

export default function ChatThreadPage() {
  const params = useParams()
  const router = useRouter()
  const conversationId = params.id as string
  const { user, loading: authLoading } = useAuth()
  const myId = user?.id ?? null

  const [messages, setMessages] = useState<Message[]>([])
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null)
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [text, setText] = useState('')
  const [offer, setOffer] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  useEffect(() => {
    if (authLoading) return
    if (!myId) {
      setLoading(false)
      return
    }
    async function load() {
      const uid = myId

      const { data: conv } = await supabase
        .from('conversations')
        .select('buyer_id, seller_id, products ( title, price, image_url )')
        .eq('id', conversationId)
        .single()

      if (conv) {
        const otherId = conv.buyer_id === uid ? conv.seller_id : conv.buyer_id
        const { data: otherProfile } = await supabase
          .from('profiles')
          .select('id, full_name, seller_verified')
          .eq('id', otherId)
          .single()
        if (otherProfile) setOtherUser(otherProfile as OtherUser)
        if (conv.products) setProduct(conv.products as unknown as ProductInfo)
      }

      const { data } = await supabase
        .from('messages')
        .select('id, sender_id, body, offer_price, image_url, audio_url, created_at')
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
  }, [conversationId, authLoading, myId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(extra?: { image_url?: string; audio_url?: string }) {
    if (!text.trim() && !offer && !extra?.image_url && !extra?.audio_url) return
    await supabase.rpc('send_message', {
      p_conversation_id: conversationId,
      p_body: text.trim() || null,
      p_offer_price: offer ? Number(offer) : null,
      p_image_url: extra?.image_url ?? null,
      p_audio_url: extra?.audio_url ?? null,
    })
    setText('')
    setOffer('')
  }

  async function handleFileUpload(file: File) {
    if (!myId) return
    setUploading(true)
    const filePath = `${myId}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('chat-media').upload(filePath, file)
    if (!error) {
      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(filePath)
      await sendMessage({ image_url: urlData.publicUrl })
    }
    setUploading(false)
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data)
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())
        if (!myId) return
        setUploading(true)
        const filePath = `${myId}/${Date.now()}-voice-note.webm`
        const { error } = await supabase.storage.from('chat-media').upload(filePath, blob)
        if (!error) {
          const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(filePath)
          await sendMessage({ audio_url: urlData.publicUrl })
        }
        setUploading(false)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch {
      alert('Microphone access denied or unavailable.')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  if (loading || authLoading) return <div className="p-6 text-center text-stone-500">Loading chat…</div>

  if (!myId) {
    return (
      <div className="max-w-md mx-auto min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-bold text-stone-900">Sign in to view this chat</p>
        <Link href="/login" className="mt-4 bg-amber-600 text-white font-semibold py-3 px-6 rounded-xl text-sm">
          Sign In
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col pb-4">
      <header className="sticky top-0 bg-white/95 backdrop-blur px-3 py-2.5 border-b border-stone-100 z-10 flex items-center gap-3">
        <Link href="/chat"><ArrowLeft size={22} className="text-stone-800" /></Link>
        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-sm font-bold text-amber-700 flex-shrink-0">
          {otherUser?.full_name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-stone-900 truncate">
            {otherUser?.full_name || 'Sthamly User'}
            {otherUser?.seller_verified && <span className="text-green-600 ml-1">✓</span>}
          </p>
          <p className="text-[11px] text-stone-400">Chat to Bargain</p>
        </div>
      </header>

      {product && (
        <div className="flex items-center gap-2.5 px-4 py-2 bg-amber-50 border-b border-amber-100">
          {product.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt="" className="w-9 h-9 rounded-lg object-cover" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-stone-800 truncate">{product.title}</p>
            <p className="text-[11px] text-amber-700 font-bold">₹{product.price}</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.map((m) => {
          const isMine = m.sender_id === myId
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  isMine ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-800'
                }`}
              >
                {m.offer_price != null && (
                  <p className={`text-xs font-bold mb-0.5 ${isMine ? 'text-amber-100' : 'text-amber-700'}`}>
                    💰 Offer: ₹{m.offer_price}
                  </p>
                )}
                {m.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.image_url} alt="" className="rounded-lg max-w-full mb-1" />
                )}
                {m.audio_url && (
                  <audio src={m.audio_url} controls className="max-w-full" />
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
        {uploading && <p className="text-[11px] text-stone-400 mb-1">Uploading…</p>}

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
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          />

          <button onClick={() => cameraInputRef.current?.click()} className="text-stone-600 flex-shrink-0">
            <Camera size={22} />
          </button>
          <button onClick={() => galleryInputRef.current?.click()} className="text-stone-600 flex-shrink-0">
            <ImageIcon size={22} />
          </button>

          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Message…"
            className="flex-1 border border-stone-300 rounded-full px-4 py-2 text-sm min-w-0"
          />

          {text.trim() || offer ? (
            <button
              onClick={() => sendMessage()}
              className="bg-amber-600 text-white p-2.5 rounded-full flex-shrink-0"
            >
              <Send size={18} />
            </button>
          ) : (
            <button
              onClick={recording ? stopRecording : startRecording}
              className={`p-2.5 rounded-full flex-shrink-0 ${recording ? 'bg-red-600 text-white' : 'text-stone-600'}`}
            >
              {recording ? <Square size={18} /> : <Mic size={22} />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
