'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

type Profile = {
  full_name: string | null
  city: string | null
  sthamly_points: number
  total_saved_rupees: number
  is_seller: boolean
  is_creator: boolean
  seller_verified: boolean
  skill_badges: string[]
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Re-runs automatically whenever the auth state actually resolves
    // (including right after coming back from Google sign-in), instead
    // of only checking once when the page first rendered.
    if (authLoading) return
    load()
  }, [authLoading, user?.id])

  async function load() {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('full_name, city, sthamly_points, total_saved_rupees, is_seller, is_creator, seller_verified, skill_badges')
      .eq('id', user.id)
      .single()
    if (data) setProfile(data as Profile)
    setLoading(false)
  }

  async function toggleRole(field: 'is_seller' | 'is_creator', value: boolean) {
    if (!profile) return
    setSaving(true)
    const next = { ...profile, [field]: value }
    setProfile(next)
    await supabase.rpc('toggle_role', {
      p_is_seller: next.is_seller,
      p_is_creator: next.is_creator,
    })
    setSaving(false)
  }

  if (loading || authLoading) return <div className="p-6 text-center text-stone-500">Loading…</div>

  if (!profile) {
    return (
      <div className="max-w-md mx-auto min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl mb-3">👤</p>
        <h1 className="text-lg font-bold text-stone-900">You&apos;re not signed in</h1>
        <p className="text-sm text-stone-500 mt-2 mb-6">
          Sign in to earn points, upload reels, and list your products.
        </p>
        <Link
          href="/login"
          className="w-full max-w-xs bg-amber-600 text-white font-semibold py-3 rounded-xl text-sm"
        >
          Sign In
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto pb-24 px-4 pt-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-amber-900">
            {profile.full_name || 'Your Profile'}
          </h1>
          <p className="text-sm text-stone-500">{profile.city}</p>
        </div>
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }}
          className="text-xs font-semibold text-stone-500 border border-stone-300 rounded-full px-3 py-1.5"
        >
          Sign Out
        </button>
      </div>

      <div className="mt-4 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-2xl p-4">
        <span className="text-xs font-medium opacity-90">Total Saved via Learning</span>
        <p className="text-3xl font-extrabold mt-0.5">₹{profile.total_saved_rupees.toFixed(0)}</p>
      </div>

      <div className="mt-3 bg-amber-600 text-white rounded-2xl p-4 flex items-center justify-between">
        <span className="font-semibold">Sthamly Points</span>
        <span className="text-2xl font-extrabold">🪙 {profile.sthamly_points}</span>
      </div>

      {profile.seller_verified && (
        <div className="mt-3 inline-flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
          ✓ Gonda ka Verified Maker
        </div>
      )}

      <div className="mt-6 bg-white border border-amber-100 rounded-2xl p-4 space-y-4">
        <RoleToggle
          label="🛍️ Seller Mode"
          description="List your handmade products in the Local Bazaar"
          checked={profile.is_seller}
          disabled={saving}
          onChange={(v) => toggleRole('is_seller', v)}
        />
        <RoleToggle
          label="🎥 Creator Mode"
          description="Upload your own 1-min reels and tag your products"
          checked={profile.is_creator}
          disabled={saving}
          onChange={(v) => toggleRole('is_creator', v)}
        />
      </div>

      <div className="mt-4 flex gap-3">
        {profile.is_seller && (
          <Link href="/sell" className="flex-1 text-center bg-stone-900 text-white font-semibold py-3 rounded-xl text-sm">
            + List a Product
          </Link>
        )}
        {profile.is_creator && (
          <Link href="/upload" className="flex-1 text-center bg-amber-600 text-white font-semibold py-3 rounded-xl text-sm">
            + Upload a Reel
          </Link>
        )}
      </div>

      {profile.skill_badges?.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-stone-800 mb-2">Verified Knowledge Badges</h2>
          <div className="flex flex-wrap gap-2">
            {profile.skill_badges.map((badge) => (
              <span key={badge} className="text-xs bg-amber-100 text-amber-800 font-semibold px-3 py-1.5 rounded-full">
                🏅 {badge}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-3 text-[11px] text-stone-400">
        <Link href="/terms" className="underline">Terms &amp; Conditions</Link>
        <span>·</span>
        <Link href="/privacy" className="underline">Privacy Policy</Link>
      </div>
    </div>
  )
}

function RoleToggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="font-semibold text-sm text-stone-900">{label}</p>
        <p className="text-xs text-stone-500">{description}</p>
      </div>
      <button
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`w-12 h-7 rounded-full flex-shrink-0 transition-colors relative ${
          checked ? 'bg-amber-600' : 'bg-stone-300'
        }`}
      >
        <span
          className={`absolute top-0.5 w-6 h-6 bg-white rounded-full transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
