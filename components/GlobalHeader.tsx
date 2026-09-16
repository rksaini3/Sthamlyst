'use client';

import Link from 'next/link';
import LanguageSelect from './LanguageSelect';
import ThemeToggle from './ThemeToggle';

export default function GlobalHeader() {
  return (
    <header className="sticky top-0 z-20 bg-[#14162E] px-6 py-3 flex items-center justify-between">
      <Link href="/" className="text-xl font-bold text-[#E0A44B]">
        Sthamly
      </Link>
      <nav className="flex items-center gap-5">
        <Link href="/dashboard" className="text-sm font-medium text-stone-200 hover:text-white transition-colors">
          Dashboard
        </Link>
        <Link href="/profile" className="text-sm font-medium text-stone-200 hover:text-white transition-colors">
          Account
        </Link>
        <LanguageSelect />
        <ThemeToggle />
      </nav>
    </header>
  );
}