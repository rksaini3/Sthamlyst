'use client'

import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

export default function TopBar() {
  return (
    <header className="sticky top-0 bg-white/95 backdrop-blur px-4 py-3 border-b border-stone-100 z-10 flex items-center justify-between">
      <h1 className="text-2xl font-extrabold text-amber-800" style={{ fontFamily: 'cursive' }}>
        Sthamly
      </h1>
      <Link href="/chat">
        <MessageCircle size={26} strokeWidth={1.8} className="text-stone-800" />
      </Link>
    </header>
  )
}
