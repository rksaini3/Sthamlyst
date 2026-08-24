'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

export default function MohallaScoreCard() {
  const { user } = useAuth()
  const [mohalla, setMohalla] = useState<string | null>(null)
  const [totalCoins, setTotalCoins] = useState(0)
  const [bonusUnlocked, setBonusUnlocked] = useState(false)

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data: profile } = await supabase
        .from('profiles')
        .select('mohalla')
        .eq('id', user!.id)
        .single()

      if (!profile?.mohalla) return
      setMohalla(profile.mohalla)

      const weekStart = getMonday(new Date()).toISOString().slice(0, 10)
      const { data: score } = await supabase
        .from('mohalla_scores')
        .select('total_coins, bonus_unlocked')
        .eq('mohalla', profile.mohalla)
        .eq('week_start', weekStart)
        .single()

      if (score) {
        setTotalCoins(score.total_coins)
        setBonusUnlocked(score.bonus_unlocked)
      }
    }
    load()
  }, [user])

  if (!mohalla) return null

  const target = 10000
  const progress = Math.min((totalCoins / target) * 100, 100)

  return (
    <div className="mx-4 mt-3 bg-white dark:bg-stone-900 border border-turmeric/30 rounded-2xl p-3">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-bold text-stone-800 dark:text-stone-100">🏘️ {mohalla} Mohalla Score</p>
        <span className="text-[11px] text-turmeric font-semibold">{totalCoins.toLocaleString('en-IN')} / {target.toLocaleString('en-IN')}</span>
      </div>
      <div className="w-full h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
        <div className="h-full bg-turmeric rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-[10px] text-stone-400 mt-1">
        {bonusUnlocked
          ? '🎉 Is hafte ka bonus unlock ho gaya — sabko mila!'
          : `${target - totalCoins} coins aur — poore mohalle ke liye ek extra local bonus unlock hoga`}
      </p>
    </div>
  )
}

function getMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}
