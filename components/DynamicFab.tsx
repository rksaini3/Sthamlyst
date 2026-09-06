'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus } from 'lucide-react'

export default function DynamicFab() {
  const pathname = usePathname()

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

  return null
}
