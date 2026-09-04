'use client'

import { useEffect, useState } from 'react'
import CategoryFilter from '@/components/CategoryFilter'
import VoiceFeed from '@/components/VoiceFeed'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

export default function Home() {
  const { user, loading: authLoading } = useAuth()
  const [activeTheme, setActiveTheme] = useState<string | null>(null)
  const [totalSaved, setTotalSaved] = useState<number | null>(null)

  useEffect(() => {
    if (authLoading || !user) {
      setTotalSaved(null) // clear stale savings when logged out / switching accounts
      return
    }

    let cancelled = false

    async function loadSavings() {
      const { data, error } = await supabase
        .from('profiles')
        .select('total_saved_rupees')
        .eq('id', user!.id)
        .single()
      if (cancelled) return // component unmounted or user changed before this resolved
      if (error) {
        console.error('savings fetch failed:', error)
        return
      }
      if (data) setTotalSaved(data.total_saved_rupees)
    }

    loadSavings()
    // Sathi-streak ping ab Profile tab pe hoga jab woh khula ho, Home load
    // hote hi nahi — isse Home page halka aur fast rehta hai.

    return () => {
      cancelled = true
    }
  }, [authLoading, user?.id])

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

      <CategoryFilter activeTheme={activeTheme} onSelect={setActiveTheme} />
      <VoiceFeed themeFilter={activeTheme} />
    </div>
  )
}
