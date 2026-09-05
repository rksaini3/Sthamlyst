'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Gavel, Users } from 'lucide-react'

type Auction = {
  id: string
  base_price: number
  current_highest_bid: number | null
  end_time: string
  status: string
  bid_count?: number
  product: {
    title: string
    image_url: string | null
    maker_name: string
  }
}

function formatTimeLeft(endTime: string): { text: string; ended: boolean } {
  const diffMs = new Date(endTime).getTime() - Date.now()
  if (diffMs <= 0) return { text: 'समाप्त', ended: true }

  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)

  if (hours > 0) return { text: `${hours}घं ${minutes}मि बाकी`, ended: false }
  if (minutes > 0) return { text: `${minutes}मि ${seconds}से बाकी`, ended: false }
  return { text: `${seconds}से बाकी`, ended: false }
}

export default function BoliTimerCard({ auction }: { auction: Auction }) {
  const [timeLeft, setTimeLeft] = useState(() => formatTimeLeft(auction.end_time))

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(formatTimeLeft(auction.end_time))
    }, 1000)
    return () => clearInterval(interval)
  }, [auction.end_time])

  const currentPrice = auction.current_highest_bid ?? auction.base_price

  return (
    <Link
      href={`/boli/${auction.id}`}
      className="block rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden"
    >
      <div className="relative">
        {auction.product.image_url ? (
          <Image
            src={auction.product.image_url}
            alt={auction.product.title}
            width={400}
            height={200}
            className="w-full h-40 object-cover"
          />
        ) : (
          <div className="w-full h-40 bg-stone-100 dark:bg-stone-800" />
        )}
        <span
          className={`absolute top-2 right-2 text-[11px] font-bold px-2.5 py-1 rounded-full ${
            timeLeft.ended
              ? 'bg-stone-700 text-white'
              : 'bg-black/70 text-white animate-pulse'
          }`}
        >
          {timeLeft.ended ? '🔨 समाप्त' : `⏱️ ${timeLeft.text}`}
        </span>
      </div>

      <div className="p-3">
        <p className="font-semibold text-sm truncate">{auction.product.title}</p>
        <p className="text-xs text-stone-500">{auction.product.maker_name}</p>

        <div className="flex items-center justify-between mt-2">
          <div>
            <p className="text-[10px] text-stone-400">
              {auction.current_highest_bid ? 'सबसे ऊंची बोली' : 'शुरुआती दाम'}
            </p>
            <p className="text-lg font-bold text-mehendi">₹{currentPrice}</p>
          </div>
          {auction.bid_count !== undefined && auction.bid_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-stone-500">
              <Users size={13} /> {auction.bid_count} बोली
            </span>
          )}
        </div>

        {!timeLeft.ended && (
          <div className="mt-2.5 flex items-center justify-center gap-1.5 bg-clay text-white text-xs font-bold py-2 rounded-xl">
            <Gavel size={14} /> बोली लगाएं
          </div>
        )}
      </div>
    </Link>
  )
}
