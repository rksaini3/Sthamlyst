'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Bell, Sparkles, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/ThemeProvider'

export default function GlobalHeader() {
  const pathname = usePathname()
  const { isDark, toggleDark } = useTheme()

  // Header is a fixed top bar present on every screen except focused
  // full-screen flows (login, story viewer/upload, chat thread)
  if (pathname === '/login' || pathname.startsWith('/chat/') || pathname.startsWith('/story/')) {
    return null
  }

  return (
    <header className="sticky top-0 bg-white/95 dark:bg-stone-900/95 backdrop-blur px-4 py-3 border-b border-stone-100 dark:border-stone-800 z-20 flex items-center justify-between">
      <Link href="/" className="text-2xl font-heading font-semibold text-clay">
        Sthamly
      </Link>
      <div className="flex items-center gap-4">
        <button onClick={toggleDark} aria-label="Toggle dark mode">
          {isDark ? (
            <Sun size={20} strokeWidth={1.8} className="text-turmeric" />
          ) : (
            <Moon size={20} strokeWidth={1.8} className="text-indigobrand" />
          )}
        </button>
        <Link href="/search" aria-label="Search">
          <Search size={22} strokeWidth={1.8} className="text-indigobrand" />
        </Link>
        <Link href="/notifications" aria-label="Notifications">
          <Bell size={22} strokeWidth={1.8} className="text-indigobrand" />
        </Link>
        <Link href="/sahayak" aria-label="Sthamly Sahayak">
          <Sparkles size={22} strokeWidth={1.8} className="text-violet" />
        </Link>
      </div>
    </header>
  )
}
