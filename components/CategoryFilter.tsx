'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const HIDDEN_THEMES = ['Clay Crafts & Home Decor']

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
      const { data, error } = await supabase
        .from('lessons')
        .select('craft_theme')
        .eq('is_published', true)
        .order('craft_theme', { ascending: true })

      if (error) {
        console.error('loadThemes failed:', error)
        return
      }
      if (data) {
        // Ordering the query alphabetically means the dedup below preserves
        // that order too, so the chip row is stable across reloads instead
        // of shuffling based on whatever order rows happened to come back in.
        const unique = Array.from(new Set(data.map((d) => d.craft_theme).filter(Boolean)))
        const visible = unique.filter((t) => !HIDDEN_THEMES.includes(t as string))
        setThemes(visible as string[])
      }
    }
    loadThemes()
  }, [])

  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2 no-scrollbar">
      <button
        onClick={() => onSelect(null)}
        className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 ${
          activeTheme === null ? 'bg-clay text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
        }`}
      >
        ✨ All
      </button>
      {themes.map((theme) => (
        <button
          key={theme}
          onClick={() => onSelect(theme)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 ${
            activeTheme === theme ? 'bg-clay text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
          }`}
        >
          {theme}
        </button>
      ))}
      <Link
        href="/announcements"
        className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 bg-indigobrand-light text-indigobrand"
      >
        📢 Announcements
      </Link>
      <Link
        href="/discover"
        className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 bg-violet-light text-violet"
      >
        📍 Near You
      </Link>
      <Link
        href="/campaigns"
        className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 bg-mehendi-light text-mehendi"
      >
        📋 Campaigns
      </Link>
    </div>
  )
}
