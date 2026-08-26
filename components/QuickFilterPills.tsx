'use client'

import Link from 'next/link'

export default function QuickFilterPills() {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2 no-scrollbar">
      <Link
        href="/announcements"
        className="flex-shrink-0 flex items-center gap-1.5 bg-rose-50 text-rose-700 text-xs font-semibold px-3 py-1.5 rounded-full"
      >
        📢 Announcements
      </Link>
      <Link
        href="/discover?tab=near-you"
        className="flex-shrink-0 flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full"
      >
        📍 Near You
      </Link>
      <Link
        href="/campaigns"
        className="flex-shrink-0 flex items-center gap-1.5 bg-amber-50 text-amber-800 text-xs font-semibold px-3 py-1.5 rounded-full"
      >
        📋 Campaigns
      </Link>
    </div>
  )
}