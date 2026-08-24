'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

type SathiPair = {
  id: string
  user_a: string
  user_b: string
  status: 'pending' | 'active' | 'broken'
  streak_count: number
  otherName?: string
}

export default function SathiStreakCard() {
  const { user } = useAuth()
  const [pair, setPair] = useState<SathiPair | null>(null)
  const [inviteHandle, setInviteHandle] = useState('')
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  async function load() {
    const { data } = await supabase
      .from('sathi_pairs')
      .select('id, user_a, user_b, status, streak_count')
      .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`)
      .in('status', ['pending', 'active'])
      .limit(1)
      .maybeSingle()

    if (data) {
      const otherId = data.user_a === user!.id ? data.user_b : data.user_a
      const { data: otherProfile } = await supabase.from('profiles').select('full_name').eq('id', otherId).single()
      setPair({ ...data, otherName: otherProfile?.full_name || 'Sathi' } as SathiPair)
    }
  }

  async function sendInvite() {
    if (!inviteHandle.trim()) return
    setInviting(true)
    setMessage('')
    const { data: target } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', inviteHandle.trim().toLowerCase())
      .single()

    if (!target) {
      setMessage('Ye handle nahi mila.')
      setInviting(false)
      return
    }

    const { error } = await supabase.rpc('invite_sathi', { p_target_user_id: target.id })
    setInviting(false)
    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Invite bhej diya!')
      load()
    }
  }

  async function acceptInvite() {
    if (!pair) return
    await supabase.rpc('accept_sathi', { p_pair_id: pair.id })
    load()
  }

  if (!user) return null

  return (
    <div className="mx-4 mt-3 bg-white dark:bg-stone-900 border border-violet/30 rounded-2xl p-3">
      <p className="text-xs font-bold text-violet mb-1.5">🤝 Sathi Streak</p>

      {!pair && (
        <div className="flex items-center gap-2">
          <input
            value={inviteHandle}
            onChange={(e) => setInviteHandle(e.target.value)}
            placeholder="@handle daal ke Sathi bulao"
            className="flex-1 border border-stone-300 dark:border-stone-700 dark:bg-stone-800 rounded-full px-3 py-1.5 text-xs"
          />
          <button onClick={sendInvite} disabled={inviting} className="text-xs font-semibold text-violet flex-shrink-0">
            Invite
          </button>
        </div>
      )}

      {pair && pair.status === 'pending' && pair.user_b === user.id && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-stone-600 dark:text-stone-300">{pair.otherName} ne Sathi banne ko poocha hai</p>
          <button onClick={acceptInvite} className="text-xs font-semibold bg-violet text-white px-3 py-1 rounded-full">
            Accept
          </button>
        </div>
      )}

      {pair && pair.status === 'pending' && pair.user_a === user.id && (
        <p className="text-xs text-stone-400">Invite {pair.otherName} ko bhej diya, response ka wait hai…</p>
      )}

      {pair && pair.status === 'active' && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-stone-600 dark:text-stone-300">
            {pair.otherName} ke saath <span className="font-bold text-violet">{pair.streak_count} din</span> ka streak
          </p>
          <span className="text-lg">🔥</span>
        </div>
      )}

      {message && <p className="text-[11px] text-stone-400 mt-1">{message}</p>}
    </div>
  )
}
