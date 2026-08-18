'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ShoppingBag, PlusSquare, MessageCircle, User } from 'lucide-react'

const items = [
  { href: '/', icon: Home },
  { href: '/bazaar', icon: ShoppingBag },
  { href: '/upload', icon: PlusSquare },
  { href: '/chat', icon: MessageCircle },
  { href: '/profile', icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()

  // Hide the nav on the login screen and inside an open chat thread
  if (pathname === '/login' || pathname.startsWith('/chat/')) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-20">
      <div className="max-w-md mx-auto flex items-center justify-around py-2.5">
        {items.map(({ href, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} className="p-2">
              <Icon
                size={26}
                strokeWidth={active ? 2.5 : 1.8}
                className={active ? 'text-stone-900' : 'text-stone-400'}
              />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
