'use client';

import Link from 'next/link';

export default function GlobalHeader() {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b">
      <Link href="/" className="text-xl font-bold text-orange-700">
        Sthamly
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/profile">Account</Link>
      </nav>
    </header>
  );
}