'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function CategoryFilter({
  activeTheme,
  onSelect,
}: {
  activeTheme: string | null
  onSelect: (theme: string | null) => void
}) {
  const [themes, setThemes] = useState<string[]>([])

  useEffect(() => {
    async function loadThemes() {
      const { data } = await supabase
        .from('lessons')
        .select('craft_theme')
        .eq('is_published', true)

      if (data) {
        const unique = Array.from(new Set(data.map((d) => d.craft_theme).filter(Boolean)))
        setThemes(unique as string[])
      }
    }
    loadThemes()
  }, [])

  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2 no-scrollbar">
      <button
        onClick={() => onSelect(null)}
        className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 ${
          activeTheme === null ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600'
        }`}
      >
        ✨ All
      </button>
      {themes.map((theme) => (
        <button
          key={theme}
          onClick={() => onSelect(theme)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 ${
            activeTheme === theme ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600'
          }`}
        >
          {theme}
        </button>
      ))}
    </div>
  )
}
