'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/ThemeProvider';

export default function ThemeToggle() {
  const { isDark, toggleDark } = useTheme();

  return (
    <button
      onClick={toggleDark}
      aria-label="Toggle dark mode"
      className="w-8 h-8 flex items-center justify-center rounded-full text-[#E0A44B] hover:bg-white/10 transition-colors"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}