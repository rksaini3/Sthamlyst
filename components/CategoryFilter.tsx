'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function CategoryFilter({
  activeTheme,
  onSelect,
}: {
  activeTheme: string | null
  onSelect: (theme: string | null) => void
}) {
  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    async function loadCategories() {
      const { data, error } = await supabase
        .from('products')
        .select('category')
        .eq('is_active', true)
        .order('category', { ascending: true })

      if (error) {
        console.error('loadCategories failed:', error)
        return
      }
      if (data) {
        // Alphabetical order se query karne se dedup ke baad bhi order
        // stable rehta hai, chip row reload pe idhar-udhar nahi hoti.
        const unique = Array.from(new Set(data.map((d) => d.category).filter(Boolean)))
        setCategories(unique as string[])
      }
    }
    loadCategories()
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

      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onSelect(category)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 ${
            activeTheme === category ? 'bg-clay text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
          }`}
        >
          {category}
        </button>
      ))}

      <Link
        href="/announcements"
        className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 bg-indigobrand-light text-indigobrand"
      >
        📢 Offers &amp; Updates
      </Link>
    </div>
  )
}
