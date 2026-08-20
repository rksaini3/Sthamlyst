'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search as SearchIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type LessonResult = { id: string; title: string; craft_theme: string }
type ProductResult = { id: string; title: string; price: number; is_service: boolean; maker_name: string }
type CreatorResult = { id: string; full_name: string | null; city: string | null }

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [lessons, setLessons] = useState<LessonResult[]>([])
  const [products, setProducts] = useState<ProductResult[]>([])
  const [creators, setCreators] = useState<CreatorResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  async function runSearch() {
    if (!query.trim()) return
    setSearching(true)
    setSearched(true)
    const q = `%${query.trim()}%`

    const [lessonRes, productRes, creatorRes] = await Promise.all([
      supabase.from('lessons').select('id, title, craft_theme').eq('is_published', true).ilike('title', q).limit(10),
      supabase.from('products').select('id, title, price, is_service, maker_name').eq('is_active', true).ilike('title', q).limit(10),
      supabase.from('profiles').select('id, full_name, city').ilike('full_name', q).limit(10),
    ])

    setLessons((lessonRes.data as LessonResult[]) || [])
    setProducts((productRes.data as ProductResult[]) || [])
    setCreators((creatorRes.data as CreatorResult[]) || [])
    setSearching(false)
  }

  return (
    <div className="max-w-md mx-auto pb-24 px-4 pt-6 min-h-dvh">
      <h1 className="text-xl font-heading font-semibold text-stone-900">Search</h1>
      <p className="text-xs text-stone-500 mt-1">Reels, creators, products & categories — sab ek jagah.</p>

      <div className="mt-4 flex items-center gap-2 border border-stone-300 rounded-xl px-3 py-2">
        <SearchIcon size={18} className="text-stone-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          placeholder="Search Sthamly…"
          className="flex-1 text-sm outline-none"
        />
      </div>
      <button
        onClick={runSearch}
        disabled={searching}
        className="mt-3 w-full bg-clay text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50"
      >
        {searching ? 'Searching…' : 'Search'}
      </button>

      {searched && !searching && (
        <div className="mt-6 space-y-6">
          {lessons.length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-2">Reels</h2>
              <div className="space-y-2">
                {lessons.map((l) => (
                  <Link key={l.id} href="/" className="block bg-white border border-stone-200 rounded-xl p-3">
                    <p className="text-sm font-semibold text-stone-800">{l.title}</p>
                    <p className="text-[11px] text-turmeric">{l.craft_theme}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {products.length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-2">Products & Services</h2>
              <div className="space-y-2">
                {products.map((p) => (
                  <Link key={p.id} href="/bazaar" className="block bg-white border border-stone-200 rounded-xl p-3">
                    <p className="text-sm font-semibold text-stone-800">{p.title}</p>
                    <p className="text-[11px] text-stone-500">
                      {p.is_service ? '🛠️ Service' : '🏺 Product'} · by {p.maker_name} · ₹{p.price}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {creators.length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-2">Creators</h2>
              <div className="space-y-2">
                {creators.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 bg-white border border-stone-200 rounded-xl p-3">
                    <div className="w-9 h-9 rounded-full bg-indigobrand-light flex items-center justify-center text-sm font-bold text-indigobrand">
                      {c.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-stone-800">{c.full_name || 'Sthamly User'}</p>
                      <p className="text-[11px] text-stone-500">{c.city}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {lessons.length === 0 && products.length === 0 && creators.length === 0 && (
            <p className="text-center text-stone-400 text-sm pt-6">No results for &quot;{query}&quot;.</p>
          )}
        </div>
      )}
    </div>
  )
}
