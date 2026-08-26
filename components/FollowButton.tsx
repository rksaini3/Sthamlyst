'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

export default function FollowButton({ targetUserId }: { targetUserId: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const [status, setStatus] = useState<'none' | 'requested' | 'accepted' | null>(null)
  const [followsMe, setFollowsMe] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || user.id === targetUserId) return
    load()
  }, [user, targetUserId])

  async function load() {
    const { data } = await supabase.rpc('get_follow_status', { p_target_user_id: targetUserId })
    setStatus(data?.my_status ?? 'none')
    setFollowsMe(!!data?.follows_me)
  }

  async function handleClick() {
    if (!user) {
      router.push('/login')
      return
    }
    setLoading(true)
    const { data, error } = await supabase.rpc('toggle_follow', { p_target_user_id: targetUserId })
    setLoading(false)
    if (!error) setStatus(data)
  }

  if (!user || user.id === targetUserId) return null

  const label =
    status === 'accepted' ? 'Following' :
    status === 'requested' ? 'Requested ⏳' :
    followsMe ? 'Follow Back' : 'Follow'

  const isActive = status === 'none' || status === null

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={
        isActive
          ? 'text-xs font-bold px-3 py-1 rounded-full bg-amber-600 text-white disabled:opacity-50'
          : 'text-xs font-semibold px-3 py-1 rounded-full bg-white/20 text-white border border-white/40 disabled:opacity-50'
      }
    >
      {label}
    </button>
  )
}