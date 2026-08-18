'use client'

import { useEffect, useState } from 'react'
import TopBar from '@/components/TopBar'
import StoriesBar from '@/components/StoriesBar'
import ReelFeed from '@/components/ReelFeed'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [activeTheme, setActiveTheme] = useState<string | null>(null)
  const [totalSaved, setTotalSaved] = useState<number | null>(null)

  useEffect(() => {
    async function loadSavings() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) return
      const { data } = await supabase
        .from('profiles')
        .select('total_saved_rupees')
        .eq('id', userData.user.id)
        .single()
      if (data) setTotalSaved(data.total_saved_rupees)
    }
    loadSavings()
  }, [])

  return (
    <div className="max-w-md mx-auto pb-24 min-h-screen">
      <TopBar />

      {totalSaved !== null && totalSaved > 0 && (
        <div className="mx-4 mt-3 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium opacity-90">आपने अब तक बचाए</p>
            <p className="text-2xl font-extrabold">₹{totalSaved.toFixed(0)}</p>
          </div>
          <span className="text-3xl">💰</span>
        </div>
      )}

      <StoriesBar activeTheme={activeTheme} onSelect={setActiveTheme} />
      <ReelFeed themeFilter={activeTheme} />
    </div>
  )
}
