'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Bell, Sparkles, ScanLine } from 'lucide-react'
import { useAuth } from '@/lib/AuthProvider'
import { supabase } from '@/lib/supabase'
import QRScannerSheet from '@/components/QRScannerSheet'

export default function GlobalHeader() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [showScanner, setShowScanner] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)

  useEffect(() => {
    if (!user) {
      setHasUnread(false)
      return
    }
    // NOTE: assumes a `notifications` table with `user_id` and
    // `is_read` columns — adjust the column/table names below if yours
    // differ.
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .then(({ count, error }) => {
        if (error) {
          console.error('unread notifications fetch failed:', error)
          return
        }
        setHasUnread((count ?? 0) > 0)
      })
  }, [user])

  // Header is a fixed top bar present on every screen except focused
  // full-screen flows (login, story viewer/upload, chat thread)
  if (pathname === '/login' || pathname.startsWith('/chat/') || pathname.startsWith('/story/')) {
    return null
  }

  return (
    <>
      <header className="sticky top-0 bg-white/95 dark:bg-stone-900/95 backdrop-blur px-4 py-3 border-b border-stone-100 dark:border-stone-800 z-20 flex items-center justify-between">
        <Link href="/" className="text-2xl font-heading font-semibold text-clay">
          Sthamly
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/search" aria-label="Search">
            <Search size={22} strokeWidth={1.8} className="text-indigo-600" />
          </Link>
          <button onClick={() => setShowScanner(true)} aria-label="Scan QR code">
            <ScanLine size={22} strokeWidth={1.8} className="text-indigo-600" />
          </button>
          <Link href="/notifications" aria-label="Notifications" className="relative">
            <Bell size={22} strokeWidth={1.8} className="text-indigo-600" />
            {hasUnread && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-stone-900" />
            )}
          </Link>
          <Link href="/sahayak" aria-label="Sthamly Sahayak">
            <Sparkles size={22} strokeWidth={1.8} className="text-violet" />
          </Link>
        </div>
      </header>

      {showScanner && <QRScannerSheet onClose={() => setShowScanner(false)} />}
    </>
  )
}
