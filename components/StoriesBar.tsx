'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const THEME_EMOJI: Record<string, string> = {
  'Clay Crafts & Home Decor': '🏺',
  'Handwoven Baskets': '🧺',
  'Painting & Art': '🎨',
  'Jute Bags': '👜',
}

export default function StoriesBar({
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
    <div className="flex gap-4 overflow-x-auto px-4 py-3 border-b border-stone-100 no-scrollbar">
      <StoryCircle
        label="All"
        emoji="✨"
        active={activeTheme === null}
        onClick={() => onSelect(null)}
      />
      {themes.map((theme) => (
        <StoryCircle
          key={theme}
          label={theme.split(' ')[0]}
          emoji={THEME_EMOJI[theme] || '🧵'}
          active={activeTheme === theme}
          onClick={() => onSelect(theme)}
        />
      ))}
    </div>
  )
}

function StoryCircle({
  label,
  emoji,
  active,
  onClick,
}: {
  label: string
  emoji: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${
          active
            ? 'bg-gradient-to-tr from-amber-500 via-orange-500 to-pink-500 p-[2.5px]'
            : 'bg-stone-200 p-[2.5px]'
        }`}
      >
        <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
          {emoji}
        </div>
      </div>
      <span className="text-[10px] text-stone-600 truncate w-full text-center">{label}</span>
    </button>
  )
}
