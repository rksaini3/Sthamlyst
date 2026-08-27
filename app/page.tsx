'use client'

import { useEffect, useState } from 'react'
import StoriesRow from '@/components/StoriesRow'
import CategoryFilter from '@/components/CategoryFilter'
import ReelFeed from '@/components/ReelFeed'
import MohallaScoreCard from '@/components/MohallaScoreCard'
import SathiStreakCard from '@/components/SathiStreakCard'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

export default function Home() {
  const { user, loading: authLoading } = useAuth()
  const [activeTheme, setActiveTheme] = useState<string | null>(null)
  const [totalSaved, setTotalSaved] = useState<number | null>(null)

  useEffect(() => {
    if (authLoading || !user) return
    async function loadSavings() {
      const { data } = await supabase
        .from('profiles')
        .select('total_saved_rupees')
        .eq('id', user!.id)
        .single()
      if (data) setTotalSaved(data.total_saved_rupees)
    }
    loadSavings()
    supabase.rpc('mark_sathi_active_today')
  }, [authLoading, user])

  return (
    <div className="max-w-md mx-auto pb-24 min-h-dvh">
      {totalSaved !== null && totalSaved > 0 && (
        <div className="mx-4 mt-3 bg-mehendi text-white rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium opacity-90">आपने अब तक बचाए</p>
            <p className="text-2xl font-extrabold">₹{totalSaved.toFixed(0)}</p>
          </div>
          <span className="text-3xl">💰</span>
        </div>
      )}

      <StoriesRow />
      <MohallaScoreCard />
      <SathiStreakCard />

      <CategoryFilter activeTheme={activeTheme} onSelect={setActiveTheme} />
      <ReelFeed themeFilter={activeTheme} />
    </div>
  )
}