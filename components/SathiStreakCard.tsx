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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    load()

    // Auto-refresh if the other person accepts/rejects while this
    // card is on screen — no manual reload needed.
    const channel = supabase
      .channel(`sathi-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sathi_pairs', filter: `user_a=eq.${user.id}` },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sathi_pairs', filter: `user_b=eq.${user.id}` },
        () => load()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function load() {
    setLoading(true)
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
    } else {
      setPair(null)
    }
    setLoading(false)
  }

  async function sendInvite() {
    const cleaned = inviteHandle.trim().toLowerCase().replace(/^@/, '')
    if (!cleaned) return

    setMessage('')

    const { data: target } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', cleaned)
      .single()

    if (!target) {
      setMessage('Ye handle nahi mila.')
      return
    }

    if (target.id === user!.id) {
      setMessage('Khud ko Sathi nahi bana sakte 😄')
      return
    }

    setInviting(true)
    const { error } = await supabase.rpc('invite_sathi', { p_target_user_id: target.id })
    setInviting(false)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Invite bhej diya!')
      setInviteHandle('')
      load()
    }
  }

  async function acceptInvite() {
    if (!pair) return
    await supabase.rpc('accept_sathi', { p_pair_id: pair.id })
    load()
  }

  async function rejectInvite() {
    if (!pair) return
    await supabase.rpc('reject_sathi', { p_pair_id: pair.id })
    setPair(null)
  }

  if (!user || loading) return null

  return (
    <div className="mx-4 mt-3 bg-white dark:bg-stone-900 border border-violet/30 rounded-2xl p-3">
      <p className="text-xs font-bold text-violet mb-1.5">🤝 Sathi Streak</p>

      {!pair && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <input
              value={inviteHandle}
              onChange={(e) => setInviteHandle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
              placeholder="@handle daal ke Sathi bulao"
              className="flex-1 border border-stone-300 dark:border-stone-700 dark:bg-stone-800 rounded-full px-3 py-1.5 text-xs"
            />
            <button
              onClick={sendInvite}
              disabled={inviting || !inviteHandle.trim()}
              className="text-xs font-semibold text-violet flex-shrink-0 disabled:opacity-40"
            >
              {inviting ? 'Bhej rahe...' : 'Invite'}
            </button>
          </div>
        </div>
      )}

      {pair && pair.status === 'pending' && pair.user_b === user.id && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-stone-600 dark:text-stone-300">{pair.otherName} ne Sathi banne ko poocha hai</p>
          <div className="flex gap-1.5 flex-shrink-0">
            <button onClick={acceptInvite} className="text-xs font-semibold bg-violet text-white px-3 py-1 rounded-full">
              Accept
            </button>
            <button onClick={rejectInvite} className="text-xs font-semibold bg-stone-100 dark:bg-stone-800 text-stone-500 px-3 py-1 rounded-full">
              Reject
            </button>
          </div>
        </div>
      )}

      {pair && pair.status === 'pending' && pair.user_a === user.id && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-stone-400">Invite {pair.otherName} ko bhej diya, response ka wait hai…</p>
          <button onClick={rejectInvite} className="text-[11px] text-stone-400 underline flex-shrink-0">
            Cancel
          </button>
        </div>
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