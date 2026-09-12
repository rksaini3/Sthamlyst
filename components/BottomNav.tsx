'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/optimizer', label: 'Optimizer' },
  { href: '/profile', label: 'Account' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-white flex justify-around py-2">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`text-sm ${
            pathname === tab.href ? 'text-orange-700 font-semibold' : 'text-gray-500'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}