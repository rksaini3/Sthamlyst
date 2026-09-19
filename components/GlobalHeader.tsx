'use client';

import Link from 'next/link';
import LanguageSelect from './LanguageSelect';
import HamburgerMenu from './HamburgerMenu';

export default function GlobalHeader() {
  return (
    <header className="sticky top-0 z-20 bg-[#14162E] px-4 py-3 flex items-center justify-between gap-3">
      <Link href="/" className="text-xl font-bold text-[#E0A44B] flex-shrink-0">
        Sthamly
      </Link>
      <div className="flex items-center gap-3 flex-shrink-0">
        <LanguageSelect />
        <HamburgerMenu />
      </div>
    </header>
  );
}
