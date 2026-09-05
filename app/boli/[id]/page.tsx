'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Mic, Square, Gavel, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

type Bid = {
  id: string
  bidder_id: string
  amount: number
  voice_note_url: string | null
  created_at: string
  bidder_name?: string
}

type AuctionDetail = {
  id: string
  base_price: number
  current_highest_bid: number | null
  end_time: string
  status: string
  seller_id: string
  product: {
    title: string
    image_url: string | null
    maker_name: string
    voice_note_url: string | null
  }
}

function timeLeftLabel(endTime: string) {
  const diffMs = new Date(endTime).getTime() - Date.now()
  if (diffMs <= 0) return 'समाप्त'
  const hours = Math.floor(diffMs / 3600000)
  const minutes = Math.floor((diffMs % 3600000) / 60000)
  if (hours > 0) return `${hours}घं ${minutes}मि बाकी`
  const seconds = Math.floor((diffMs % 60000) / 1000)
  return `${minutes}मि ${seconds}से बाकी`
}

export default function BoliDetailPage() {
  const params = useParams()
  const auctionId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string)
  const { user } = useAuth()

  const [auction, setAuction] = useState<AuctionDetail | null>(null)
  const [bids, setBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)
  const [bidAmount, setBidAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [timeLeft, setTimeLeft] = useState('')

  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function loadAuction() {
    const { data, error: fetchError } = await supabase
      .from('auctions')
      .select('id, base_price, current_highest_bid, end_time, status, seller_id, products ( title, image_url, maker_name, voice_note_url )')
      .eq('id', auctionId)
      .single()

    if (fetchError || !data) return
    const productData = data.products as unknown as AuctionDetail['product']
    setAuction({
      id: data.id,
      base_price: data.base_price,
      current_highest_bid: data.current_highest_bid,
      end_time: data.end_time,
      status: data.status,
      seller_id: data.seller_id,
      product: productData,
    })
  }

  async function loadBids() {
    const { data } = await supabase
      .from('bids')
      .select('id, bidder_id, amount, voice_note_url, created_at')
      .eq('auction_id', auctionId)
      .order('amount', { ascending: false })

    if (!data) return

    const bidderIds = [...new Set(data.map((b) => b.bidder_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', bidderIds)

    const nameMap: Record<string, string> = {}
    ;(profiles ?? []).forEach((p: { id: string; full_name: string | null }) => {
      nameMap[p.id] = p.full_name || 'Sthamly User'
    })

    setBids(data.map((b) => ({ ...b, bidder_name: nameMap[b.bidder_id] })))
  }

  useEffect(() => {
    if (!auctionId) return
    let cancelled = false

    async function init() {
      setLoading(true)
      await Promise.all([loadAuction(), loadBids()])
      if (!cancelled) setLoading(false)
    }
    init()

    const channel = supabase
      .channel(`auction:${auctionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions', filter: `id=eq.${auctionId}` }, () => loadAuction())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids', filter: `auction_id=eq.${auctionId}` }, () => loadBids())
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [auctionId])

  useEffect(() => {
    if (!auction) return
    setTimeLeft(timeLeftLabel(auction.end_time))
    const interval = setInterval(() => setTimeLeft(timeLeftLabel(auction.end_time)), 1000)
    return () => clearInterval(interval)
  }, [auction?.end_time])

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }))
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch {
      setError('Microphone access nahi mila.')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function placeBid() {
    setError('')
    if (!user) {
      setError('Bid lagane ke liye sign in karein.')
      return
    }
    if (!auction) return

    const amountNum = Number(bidAmount)
    const currentPrice = auction.current_highest_bid ?? auction.base_price
    if (!amountNum || amountNum <= currentPrice) {
      setError(`Bid ₹${currentPrice} se zyada honi chahiye.`)
      return
    }
    if (auction.seller_id === user.id) {
      setError('Aap apni khud ki boli mein bid nahi kar sakte.')
      return
    }

    setSubmitting(true)
    try {
      let voiceUrl: string | null = null
      if (audioBlob) {
        const path = `${user.id}/${Date.now()}-bid.webm`
        const { error: uploadErr } = await supabase.storage
          .from('comment-audio')
          .upload(path, audioBlob, { contentType: 'audio/webm' })
        if (!uploadErr) {
          const { data } = supabase.storage.from('comment-audio').getPublicUrl(path)
          voiceUrl = data.publicUrl
        }
      }

      const { error: bidError } = await supabase.from('bids').insert({
        auction_id: auction.id,
        bidder_id: user.id,
        amount: amountNum,
        voice_note_url: voiceUrl,
      })
      if (bidError) throw new Error(bidError.message)

      await supabase
        .from('auctions')
        .update({ current_highest_bid: amountNum })
        .eq('id', auction.id)

      setBidAmount('')
      setAudioBlob(null)
      await loadBids()
      await loadAuction()
    } catch (err: any) {
      setError(err?.message || 'Bid lagane mein dikkat aayi.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="text-center text-stone-400 text-sm mt-10">लोड हो रहा है…</p>
  }

  if (!auction) {
    return (
      <div className="max-w-md mx-auto min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <p className="text-3xl mb-3">⚠️</p>
        <p className="text-sm text-stone-600 dark:text-stone-300">Ye boli nahi mili.</p>
        <Link href="/boli" className="mt-4 text-sm font-semibold text-clay underline">Boli Board pe wapas jaayein</Link>
      </div>
    )
  }

  const currentPrice = auction.current_highest_bid ?? auction.base_price
  const isEnded = auction.status === 'ended' || new Date(auction.end_time) < new Date()

  return (
    <div className="max-w-md mx-auto pb-24">
      <header className="sticky top-0 bg-white/95 dark:bg-stone-900/95 backdrop-blur px-3 py-2.5 border-b border-stone-100 dark:border-stone-800 z-10 flex items-center gap-3">
        <Link href="/boli"><ArrowLeft size={22} /></Link>
        <p className="text-sm font-semibold truncate">{auction.product.title}</p>
      </header>

      {auction.product.image_url && (
        <Image src={auction.product.image_url} alt={auction.product.title} width={500} height={280} className="w-full h-56 object-cover" />
      )}

      <div className="px-4 pt-4">
        <p className="text-xs text-stone-500">{auction.product.maker_name}</p>
        <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100">{auction.product.title}</h1>

        <div className="flex items-center justify-between mt-3 bg-stone-50 dark:bg-stone-800 rounded-2xl p-4">
          <div>
            <p className="text-[11px] text-stone-500">{auction.current_highest_bid ? 'सबसे ऊंची बोली' : 'शुरुआती दाम'}</p>
            <p className="text-2xl font-extrabold text-mehendi">₹{currentPrice}</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${isEnded ? 'bg-stone-700 text-white' : 'bg-clay/10 text-clay'}`}>
            {isEnded ? '🔨 समाप्त' : `⏱️ ${timeLeft}`}
          </span>
        </div>

        {!isEnded && (
          <div className="mt-4">
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              अपनी बोली लगाएं (कम से कम ₹{currentPrice + 1})
            </label>
            <div className="flex items-center gap-2">
              <span className="text-stone-500">₹</span>
              <input
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={String(currentPrice + 10)}
                className="flex-1 border border-stone-300 dark:border-stone-700 dark:bg-stone-800 rounded-xl px-3 py-2.5 text-sm"
              />
              {!audioBlob ? (
                <button
                  onClick={recording ? stopRecording : startRecording}
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-white flex-shrink-0 ${recording ? 'bg-red-500' : 'bg-mehendi'}`}
                  aria-label="Voice ke saath bid boliye"
                >
                  {recording ? <Square size={16} /> : <Mic size={18} />}
                </button>
              ) : (
                <button onClick={() => setAudioBlob(null)} className="text-xs text-stone-400 flex-shrink-0">
                  🎙️ हटाएं
                </button>
              )}
            </div>

            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

            <button
              onClick={placeBid}
              disabled={submitting}
              className="mt-3 w-full flex items-center justify-center gap-2 bg-clay text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50"
            >
              <Gavel size={16} /> {submitting ? 'Bid lag rahi hai…' : 'बोली लगाएं'}
            </button>
          </div>
        )}

        <h2 className="text-sm font-bold text-stone-800 dark:text-stone-100 mt-6 mb-2">सारी बोलियां ({bids.length})</h2>
        <div className="space-y-2">
          {bids.length === 0 ? (
            <p className="text-xs text-stone-400">अभी तक कोई बोली नहीं लगी।</p>
          ) : (
            bids.map((bid, i) => (
              <div
                key={bid.id}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${i === 0 ? 'bg-mehendi-light' : 'bg-stone-50 dark:bg-stone-800'}`}
              >
                <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center flex-shrink-0">
                  <User size={14} className="text-stone-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{bid.bidder_name}</p>
                  {bid.voice_note_url && <audio src={bid.voice_note_url} controls className="h-6 mt-0.5 max-w-full" />}
                </div>
                <p className={`text-sm font-bold flex-shrink-0 ${i === 0 ? 'text-mehendi' : 'text-stone-600'}`}>₹{bid.amount}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
