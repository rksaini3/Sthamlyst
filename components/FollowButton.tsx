'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

export default function FollowButton({ targetUserId }: { targetUserId: string }) {
  const { user } = useAuth()
  const [following, setFollowing] = useState(false)
  const [followsYou, setFollowsYou] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user || user.id === targetUserId) {
      setLoading(false)
      return
    }
    checkStatus()
  }, [user?.id, targetUserId])

  async function checkStatus() {
    setLoading(true)
    const [a, b] = await Promise.all([
      supabase.from('follows').select('follower_id').eq('follower_id', user!.id).eq('following_id', targetUserId).maybeSingle(),
      supabase.from('follows').select('follower_id').eq('follower_id', targetUserId).eq('following_id', user!.id).maybeSingle(),
    ])
    setFollowing(!!a.data)
    setFollowsYou(!!b.data)
    setLoading(false)
  }

  async function handleToggle() {
    if (!user || saving) return
    setSaving(true)
    const nowFollowing = !following
    setFollowing(nowFollowing) // optimistic
    const { error } = await supabase.rpc('toggle_follow', { p_target_user_id: targetUserId })
    if (error) setFollowing(!nowFollowing) // revert on failure
    setSaving(false)
  }

  if (!user || user.id === targetUserId || loading) return null

  // NOTE: "Requested ⏳" (private-account approval flow) needs a schema
  // change — follows table has no pending/approved status yet. This
  // button currently only supports immediate Follow / Follow Back,
  // same as a public-account model.
  const label = following ? 'Following' : followsYou ? 'Follow Back' : '+ Follow'

  return (
    <button
      onClick={handleToggle}
      disabled={saving}
      className={`text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 ${
        following
          ? 'bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300'
          : 'bg-clay text-white'
      }`}
    >
      {label}
    </button>
  )
}