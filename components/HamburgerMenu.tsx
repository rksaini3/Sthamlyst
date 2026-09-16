'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, Settings, Shield, FileText, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/ThemeProvider';

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const { isDark, toggleDark } = useTheme();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        className="w-9 h-9 flex items-center justify-center rounded-full text-stone-200 hover:bg-white/10 transition-colors"
      >
        <Menu size={20} />
      </button>

      {open && (
        <>
          {/* Backdrop to close menu on outside click */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 top-11 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl shadow-lg py-1 z-20 min-w-[190px] overflow-hidden">
            <button
              onClick={toggleDark}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </button>

            <div className="h-px bg-stone-100 dark:bg-stone-800 my-1" />

            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
            >
              <Settings size={16} />
              Settings
            </Link>

            <Link
              href="/privacy"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
            >
              <Shield size={16} />
              Privacy Policy
            </Link>

            <Link
              href="/terms"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
            >
              <FileText size={16} />
              Terms & Conditions
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
