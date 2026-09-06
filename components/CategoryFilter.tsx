'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ListFilter, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function CategoryFilter({
  activeTheme,
  onSelect,
}: {
  activeTheme: string | null
  onSelect: (theme: string | null) => void
}) {
  const [categories, setCategories] = useState<string[]>([])
  const [showCategorySheet, setShowCategorySheet] = useState(false)
  const [comingSoonMsg, setComingSoonMsg] = useState('')

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
        const unique = Array.from(new Set(data.map((d) => d.category).filter(Boolean)))
        setCategories(unique as string[])
      }
    }
    loadCategories()
  }, [])

  function handleComingSoon(label: string) {
    setComingSoonMsg(`${label} jald aa raha hai!`)
    setTimeout(() => setComingSoonMsg(''), 2500)
  }

  const isCategoryActive = activeTheme !== null && activeTheme !== 'NEAR_YOU'

  return (
    <div>
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-2 no-scrollbar">
        <button
          onClick={() => onSelect(null)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 ${
            activeTheme === null ? 'bg-clay text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
          }`}
        >
          ✨ All
        </button>

        <button
          onClick={() => onSelect(activeTheme === 'NEAR_YOU' ? null : 'NEAR_YOU')}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 ${
            activeTheme === 'NEAR_YOU' ? 'bg-clay text-white' : 'bg-violet-light text-violet'
          }`}
        >
          📍 Near You
        </button>

        <Link
          href="/announcements"
          className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 bg-indigobrand-light text-indigobrand"
        >
          📢 Offers &amp; Updates
        </Link>

        <button
          onClick={() => handleComingSoon('Mandi Bhaav')}
          className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 bg-stone-100 dark:bg-stone-800 text-stone-400"
        >
          🌾 Mandi Bhaav
        </button>

        <button
          onClick={() => handleComingSoon('Mausam')}
          className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 bg-stone-100 dark:bg-stone-800 text-stone-400"
        >
          🌦️ Mausam
        </button>

        <button
          onClick={() => setShowCategorySheet(true)}
          aria-label="Aur categories"
          className={`p-1.5 rounded-full flex-shrink-0 ${
            isCategoryActive ? 'bg-clay text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
          }`}
        >
          <ListFilter size={16} />
        </button>
      </div>

      {comingSoonMsg && (
        <p className="px-4 text-[11px] text-stone-400 -mt-1 mb-1">{comingSoonMsg}</p>
      )}

      {isCategoryActive && (
        <div className="px-4 -mt-1 mb-1">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-clay bg-clay/10 px-2.5 py-1 rounded-full">
            {activeTheme}
            <button onClick={() => onSelect(null)} aria-label="Filter hataayein">
              <X size={11} />
            </button>
          </span>
        </div>
      )}

      {showCategorySheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowCategorySheet(false)}>
          <div
            className="w-full max-w-md bg-white dark:bg-stone-900 rounded-t-3xl p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">Category chuniye</h2>
              <button onClick={() => setShowCategorySheet(false)} aria-label="Band karein">
                <X size={20} className="text-stone-400" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => {
                    onSelect(category)
                    setShowCategorySheet(false)
                  }}
                  className={`text-xs font-semibold px-3 py-2 rounded-full ${
                    activeTheme === category ? 'bg-clay text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
