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
  const [sheetOpen, setSheetOpen] = useState(false)

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

  // Agar activeTheme kisi "baaki category" (funnel wali list) mein se hai,
  // to funnel-button khud bhi highlight dikhे — taaki user ko pata rahe
  // ki filter laga hua hai, chahe wo pill row mein na dikh raha ho.
  const isOverflowCategoryActive = activeTheme !== null && categories.includes(activeTheme)

  return (
    <>
      <div className="flex gap-2 overflow-x-auto px-4 py-2 no-scrollbar items-center">
        {/* 1. All — hamesha pehla, safest default */}
        <button
          onClick={() => onSelect(null)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 ${
            activeTheme === null
              ? 'bg-clay text-white'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
          }`}
        >
          ✨ All
        </button>

        {/* 2. Near You — location-based feed filter.
            '__near_you__' ek sentinel value hai; parent component (jahan
            onSelect handle hota hai) ko yahi value dekh kar user ki
            location (jo already permission se available hai) ke hisaab
            se products query mein radius-filter lagana hai. */}
        <button
          onClick={() => onSelect('__near_you__')}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 ${
            activeTheme === '__near_you__'
              ? 'bg-clay text-white'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
          }`}
        >
          📍 Near You
        </button>

        {/* 3. Offers & Updates — Campaign + Announcements dono yahi combine ho gaye,
            taaki alag-alag do pills na bane. /announcements route ko hi
            dono content types dikhane wala bana do (ya rename kar do /offers). */}
        <Link
          href="/announcements"
          className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 bg-indigobrand-light text-indigobrand"
        >
          📢 Offers &amp; Updates
        </Link>

        {/* 4. Mandi Bhaav — Agmarknet API wali screen.
            Route abhi banana baaki hai agar exist nahi karta. */}
        <Link
          href="/mandi-bhaav"
          className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300"
        >
          📊 Mandi Bhaav
        </Link>

        {/* 5. Mausam — Weather API wali screen.
            Route abhi banana baaki hai agar exist nahi karta. */}
        <Link
          href="/mausam"
          className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300"
        >
          🌦️ Mausam
        </Link>

        {/* 6. Funnel — baaki saari product-categories yahan chhupi rehti hain,
            taaki pill-row lambi na ho (Hick's Law). */}
        <button
          onClick={() => setSheetOpen(true)}
          aria-label="Aur categories dekhein"
          className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 border ${
            isOverflowCategoryActive
              ? 'bg-clay text-white border-clay'
              : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-700'
          }`}
        >
          ⚙️ {isOverflowCategoryActive ? activeTheme : 'Aur'}
        </button>
      </div>

      {/* Bottom Sheet — saari product-categories (Sabzi, Antique, Handicraft, etc.) */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="w-full bg-white dark:bg-stone-900 rounded-t-2xl px-4 pt-3 pb-6 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-stone-300 dark:bg-stone-700 rounded-full mx-auto mb-4" />
            <h3 className="text-sm font-semibold text-stone-500 dark:text-stone-400 mb-3">
              Category Chunein
            </h3>
            <div className="flex flex-col gap-1">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => {
                    onSelect(category)
                    setSheetOpen(false)
                  }}
                  className={`text-left text-sm font-medium px-3 py-2.5 rounded-lg ${
                    activeTheme === category
                      ? 'bg-clay text-white'
                      : 'text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  {category}
                </button>
              ))}
              {categories.length === 0 && (
                <p className="text-sm text-stone-400 px-3 py-2">
                  Abhi koi category available nahi hai.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}