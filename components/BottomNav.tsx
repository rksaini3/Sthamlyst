'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutDashboard, Wrench, User } from 'lucide-react';

const items = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/optimizer', label: 'Optimizer', icon: Wrench },
  { href: '/profile', label: 'Account', icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white dark:bg-[#14162E] border-t border-stone-100 dark:border-stone-800 flex justify-around py-2">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-0.5 px-3 py-1"
          >
            <Icon
              size={20}
              className={active ? 'text-[#8B85E3]' : 'text-stone-400 dark:text-stone-500'}
            />
            <span
              className={`text-[11px] font-medium ${
                active ? 'text-[#8B85E3]' : 'text-stone-400 dark:text-stone-500'
              }`}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}