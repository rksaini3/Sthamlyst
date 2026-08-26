'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageSkeleton from '@/components/PageSkeleton'
import { Menu, Settings, Moon, Sun, Shield, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'
import CreatorIdentitySetup from '@/components/CreatorIdentitySetup'

type Profile = {
  full_name: string | null
  city: string | null
  sthamly_points: number
  total_saved_rupees: number
  is_seller: boolean
  is_creator: boolean
  seller_verified: boolean
  skill_badges: string[]
  username: string | null
  bio: string | null
  avatar_url: string | null
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [debugError, setDebugError] = useState('')
  const [showIdentitySetup, setShowIdentitySetup] = useState(false)

  // ---- Hamburger menu + Dark Mode ----
  const [menuOpen, setMenuOpen] = useState(false)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sthamly-theme')
    const prefersDark = saved
      ? saved === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches
    setIsDark(prefersDark)
    document.documentElement.classList.toggle('dark', prefersDark)
  }, [])

  function toggleDarkMode() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('sthamly-theme', next ? 'dark' : 'light')
  }

  useEffect(() => {
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
    setDebugError('')

    let { data, error } = await supabase
      .from('profiles')
      .select('full_name, city, sthamly_points, total_saved_rupees, is_seller, is_creator, seller_verified, skill_badges, username, bio, avatar_url')
      .eq('id', user.id)
      .single()

    if (error && !data) {
      const ensureResult = await supabase.rpc('ensure_profile')
      if (ensureResult.error) {
        setDebugError(`ensure_profile: ${ensureResult.error.message}`)
      }
      const retry = await supabase
        .from('profiles')
        .select('full_name, city, sthamly_points, total_saved_rupees, is_seller, is_creator, seller_verified, skill_badges, username, bio, avatar_url')
        .eq('id', user.id)
        .single()
      data = retry.data
      if (retry.error && !data) {
        setDebugError((prev) => prev + ` | re-select: ${retry.error.message}`)
      }
    }

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

    if (field === 'is_creator' && value && !profile.username) {
      setShowIdentitySetup(true)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading || authLoading) return <PageSkeleton rows={1} />

  if (!user) {
    return (
      <div className="max-w-md mx-auto min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl mb-3">👤</p>
        <h1 className="text-lg font-bold text-stone-900">You&apos;re not signed in</h1>
        <p className="text-sm text-stone-500 mt-2 mb-6">
          Sign in to earn points, upload reels, and list your products.
        </p>
        <Link
          href="/login"
          className="w-full max-w-xs bg-clay text-white font-semibold py-3 rounded-xl text-sm"
        >
          Sign In
        </Link>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl mb-3">⚠️</p>
        <h1 className="text-lg font-bold text-stone-900">Couldn&apos;t load your profile</h1>
        <p className="text-sm text-stone-500 mt-2 mb-6">
          You&apos;re signed in as {user.email}, but something went wrong loading your profile
          data. Try again in a moment.
        </p>
        <button
          onClick={() => load()}
          className="w-full max-w-xs bg-clay text-white font-semibold py-3 rounded-xl text-sm"
        >
          Retry
        </button>
        {debugError && (
          <p className="text-[11px] text-red-500 mt-4 max-w-xs break-words">
            {debugError}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto pb-24 px-4 pt-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-indigobrand-light flex items-center justify-center text-lg font-bold text-indigobrand">
              {profile.full_name?.[0]?.toUpperCase() || 'R'}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-amber-900">
              {profile.full_name || 'Your Profile'}
            </h1>
            {profile.username && <p className="text-xs text-stone-400">@{profile.username}</p>}
            <p className="text-sm text-stone-500">{profile.city}</p>
          </div>
        </div>

        {/* ---- Hamburger menu (replaces old Settings-icon + Sign-Out pair) ---- */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="text-stone-500 dark:text-stone-300 border border-stone-300 dark:border-stone-600 rounded-full p-1.5"
            aria-label="Menu"
          >
            <Menu size={18} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-lg py-1 z-20 min-w-[180px]">
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700"
                >
                  <Settings size={16} /> Settings
                </Link>
                <Link
                  href="/settings/privacy"
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700"
                >
                  <Shield size={16} /> Privacy
                </Link>
                <button
                  onClick={toggleDarkMode}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700"
                >
                  {isDark ? <Sun size={16} /> : <Moon size={16} />}
                  {isDark ? 'Light Mode' : 'Dark Mode'}
                </button>
                <div className="my-1 border-t border-stone-100 dark:border-stone-700" />
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {user && (
        <Link href={`/followers/${user.id}`} className="text-xs text-indigobrand font-semibold mt-2 inline-block">
          Followers &amp; Following →
        </Link>
      )}

      <div className="mt-4 bg-mehendi text-white rounded-2xl p-4">
        <span className="text-xs font-medium opacity-90">Total Saved via Learning</span>
        <p className="text-3xl font-extrabold mt-0.5">₹{profile.total_saved_rupees.toFixed(0)}</p>
      </div>

      <div className="mt-3 bg-turmeric text-white rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Sthamly Coins</span>
          <span className="text-2xl font-extrabold">🪙 {profile.sthamly_points}</span>
        </div>
        <Link
          href="/bazaar"
          className="mt-2 block text-center bg-white/20 hover:bg-white/30 text-white font-semibold py-2 rounded-xl text-xs"
        >
          Redeem Coins in Bazaar →
        </Link>
      </div>

      {profile.seller_verified && (
        <div className="mt-3 inline-flex items-center gap-1.5 bg-mehendi-light text-mehendi text-xs font-semibold px-3 py-1.5 rounded-full">
          ✓ Gonda ka Verified Maker
        </div>
      )}

      <div className="mt-6 bg-white dark:bg-stone-800 border border-amber-100 dark:border-stone-700 rounded-2xl p-4 space-y-4">
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
          <Link href="/upload" className="flex-1 text-center bg-clay text-white font-semibold py-3 rounded-xl text-sm">
            + Upload a Reel
          </Link>
        )}
      </div>

      {profile.skill_badges?.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-2">Verified Knowledge Badges</h2>
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

      {showIdentitySetup && (
        <CreatorIdentitySetup
          onClose={() => setShowIdentitySetup(false)}
          onSaved={() => { setShowIdentitySetup(false); load() }}
        />
      )}
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
        <p className="font-semibold text-sm text-stone-900 dark:text-stone-100">{label}</p>
        <p className="text-xs text-stone-500 dark:text-stone-400">{description}</p>
      </div>
      <button
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`w-12 h-7 rounded-full flex-shrink-0 transition-colors relative ${
          checked ? 'bg-clay' : 'bg-stone-300'
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