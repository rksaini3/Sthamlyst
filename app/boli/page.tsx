'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import BoliTimerCard from '@/components/BoliTimerCard'

type AuctionRow = {
  id: string
  base_price: number
  current_highest_bid: number | null
  end_time: string
  status: string
  products: {
    title: string
    image_url: string | null
    maker_name: string
  } | null
}

type Auction = {
  id: string
  base_price: number
  current_highest_bid: number | null
  end_time: string
  status: string
  bid_count: number
  product: {
    title: string
    image_url: string | null
    maker_name: string
  }
}

export default function BoliPage() {
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      const { data, error } = await supabase
        .from('auctions')
        .select('id, base_price, current_highest_bid, end_time, status, products ( title, image_url, maker_name )')
        .in('status', ['live', 'ended'])
        .order('status', { ascending: true }) // live pehle, ended baad mein
        .order('end_time', { ascending: true })

      if (cancelled) return
      if (error) {
        console.error('auctions fetch failed:', error)
        setLoading(false)
        return
      }

      const rows = (data ?? []) as unknown as AuctionRow[]
      const validRows = rows.filter((row) => row.products)

      // Har auction ke bids ki ginti nikaalo
      const { data: bidCounts } = await supabase
        .from('bids')
        .select('auction_id')
        .in('auction_id', validRows.map((r) => r.id))

      const countMap: Record<string, number> = {}
      ;(bidCounts ?? []).forEach((b: { auction_id: string }) => {
        countMap[b.auction_id] = (countMap[b.auction_id] ?? 0) + 1
      })

      const mapped: Auction[] = validRows.map((row) => ({
        id: row.id,
        base_price: row.base_price,
        current_highest_bid: row.current_highest_bid,
        end_time: row.end_time,
        status: row.status,
        bid_count: countMap[row.id] ?? 0,
        product: row.products!,
      }))

      setAuctions(mapped)
      setLoading(false)
    }

    load()

    // Naye bids ya auction status changes live update ho jaayein
    const channel = supabase
      .channel('auctions-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids' }, () => load())
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="max-w-md mx-auto pb-24 px-4 pt-4">
      <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-1">🔨 Boli Board</h1>
      <p className="text-xs text-stone-500 mb-4">Live nilami — sabse ऊंची bid jeetegi</p>

      {loading ? (
        <p className="text-center text-stone-400 text-sm mt-10">लोड हो रहा है…</p>
      ) : auctions.length === 0 ? (
        <p className="text-center text-stone-400 text-sm mt-16 px-6">
          अभी कोई लाइव बोली नहीं है। Profile से अपनी पहली बोली शुरू करें!
        </p>
      ) : (
        <div className="space-y-3">
          {auctions.map((auction) => (
            <BoliTimerCard key={auction.id} auction={auction} />
          ))}
        </div>
      )}
    </div>
  )
}
