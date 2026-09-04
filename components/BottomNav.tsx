'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Mic, Gavel, MessageCircle, User } from 'lucide-react'

const items = [
  { href: '/', icon: Mic, label: 'Home' },
  { href: '/boli', icon: Gavel, label: 'Boli' },
  { href: '/chat', icon: MessageCircle, label: 'Chats' },
  { href: '/profile', icon: User, label: 'Profile' },
]

export default function BottomNav() {
  const pathname = usePathname()

  // Hide the nav on the login screen and inside an open chat thread
  if (pathname === '/login' || pathname.startsWith('/chat/')) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-700 z-20 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto flex items-center justify-around py-2.5">
        {items.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="p-2 flex flex-col items-center gap-0.5"
              aria-label={label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                size={26}
                strokeWidth={active ? 2.5 : 1.8}
                className={active ? 'text-stone-900 dark:text-stone-100' : 'text-stone-400 dark:text-stone-500'}
              />
              <span
                className={`text-[10px] ${
                  active ? 'text-stone-900 dark:text-stone-100 font-medium' : 'text-stone-400 dark:text-stone-500'
                }`}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
