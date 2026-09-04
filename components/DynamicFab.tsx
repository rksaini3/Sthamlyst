'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, Gavel } from 'lucide-react'

export default function DynamicFab() {
  const pathname = usePathname()

  // Sirf Home aur Boli tabs pe dikhna hai — Chats/Profile ya login/chat-thread pe nahi
  if (pathname === '/login' || pathname.startsWith('/chat/')) return null

  if (pathname === '/') {
    return (
      <Link
        href="/sell"
        aria-label="Naya listing daalein"
        className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-clay text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
      >
        <Plus size={26} />
      </Link>
    )
  }

  if (pathname === '/boli') {
    return (
      <Link
        href="/boli/new"
        aria-label="Nayi boli shuru karein"
        className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-mehendi text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
      >
        <Gavel size={24} />
      </Link>
    )
  }

  return null
}
