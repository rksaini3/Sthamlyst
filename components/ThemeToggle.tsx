'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sthamly-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = stored ? stored === 'dark' : prefersDark;
    setIsDark(shouldBeDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('sthamly-theme', next ? 'dark' : 'light');
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="w-8 h-8 flex items-center justify-center rounded-full text-[#E0A44B] hover:bg-white/10 transition-colors"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}