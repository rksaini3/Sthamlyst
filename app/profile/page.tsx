'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageSkeleton from '@/components/PageSkeleton'
import { Menu, Settings, Moon, Sun, Shield, LogOut, BadgeCheck, QrCode, ScanLine } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'
import CreatorIdentitySetup from '@/components/CreatorIdentitySetup'
import EditProfileSheet from '@/components/EditProfileSheet'
import ShareProfileSheet from '@/components/ShareProfileSheet'
import QRScannerSheet from '@/components/QRScannerSheet'
import ProfessionalDashboard from '@/components/ProfessionalDashboard'

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
  is_verified: boolean
  is_private: boolean
  pronouns: string | null
  gender: string | null
}

type Wallet = {
  seller_earnings: number
  is_seller_pro: boolean
  plan_renews_at: string | null
}

type Stats = {
  followers_count: number
  following_count: number
  posts_count: number
}

type ContentTab = 'reels' | 'products' | 'ads' | 'saved'

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [debugError, setDebugError] = useState('')
  const [showIdentitySetup, setShowIdentitySetup] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [contentTab, setContentTab] = useState<ContentTab>('reels')

  const [menuOpen, setMenuOpen] = useState(false)
  const [isDark, setIsDark] = useState(false)

  // New: QR share / scan / professional dashboard sheets
  const [showShareQR, setShowShareQR] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      .select('full_name, city, sthamly_points, total_saved_rupees, is_seller, is_creator, seller_verified, skill_badges, username, bio, avatar_url, is_verified, is_private, pronouns, gender')
      .eq('id', user.id)
      .single()

    if (error && !data) {
      const ensureResult = await supabase.rpc('ensure_profile')
      if (ensureResult.error) {
        setDebugError(`ensure_profile: ${ensureResult.error.message}`)
      }
      const retry = await supabase
        .from('profiles')
        .select('full_name, city, sthamly_points, total_saved_rupees, is_seller, is_creator, seller_verified, skill_badges, username, bio, avatar_url, is_verified, is_private, pronouns, gender')
        .eq('id', user.id)
        .single()
      data = retry.data
      if (retry.error && !data) {
        setDebugError((prev) => prev + ` | re-select: ${retry.error.message}`)
      }
    }

    if (data) setProfile(data as Profile)

    const { data: walletData, error: walletError } = await supabase.rpc('get_wallet_summary')
    if (walletError) {
      console.error('get_wallet_summary error:', walletError)
    } else if (walletData) {
      setWallet(walletData as Wallet)
    }

    // Followers / Following / Posts — independent of wallet, so it always shows
    const { data: statsData, error: statsError } = await supabase.rpc('get_profile_stats')
    if (statsError) {
      console.error('get_profile_stats error:', statsError)
    } else if (statsData) {
      setStats(statsData as Stats)
    }

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
            <img src={profile.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-indigobrand-light flex items-center justify-center text-lg font-bold text-indigobrand">
              {profile.full_name?.[0]?.toUpperCase() || 'R'}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-bold text-amber-900">
                {profile.full_name || 'Your Profile'}
              </h1>
              {profile.pronouns && <span className="text-sm text-stone-400">{profile.pronouns}</span>}
              {profile.is_verified && <BadgeCheck size={18} className="text-sky-500 fill-sky-500/20" />}
            </div>
            {profile.username && <p className="text-xs text-stone-400">@{profile.username}</p>}
            <p className="text-sm text-stone-500">{profile.city}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShareQR(true)}
            className="text-stone-500 dark:text-stone-300 border border-stone-300 dark:border-stone-600 rounded-full p-1.5"
            aria-label="Share profile QR"
          >
            <QrCode size={18} />
          </button>

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
                    onClick={() => { setMenuOpen(false); setShowScanner(true) }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700"
                  >
                    <ScanLine size={16} /> Scan QR Code
                  </button>
                  <button
                    onClick={toggleDarkMode}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700"
                  >
                    {isDark ? <Sun size={16} /> : <Moon size={16} />}
                    {isDark ? 'Light Mode' : 'Dark Mode'}
                  </button>
                  {!profile.is_verified && (
                    <Link
                      href="/verify"
                      onClick={() => setMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700"
                    >
                      <BadgeCheck size={16} /> Apply for Verified Badge
                    </Link>
                  )}
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
      </div>

      {/* Social bar — Followers | Following | Posts | Saved (₹) — independent of wallet RPC */}
      {user && stats && (
        <div className="flex items-center gap-5 mt-4">
          <Link href={`/followers/${user.id}`} className="text-center">
            <p className="text-base font-bold text-stone-900 dark:text-stone-100">{stats.followers_count}</p>
            <p className="text-[11px] text-stone-500">Followers</p>
          </Link>
          <Link href={`/followers/${user.id}`} className="text-center">
            <p className="text-base font-bold text-stone-900 dark:text-stone-100">{stats.following_count}</p>
            <p className="text-[11px] text-stone-500">Following</p>
          </Link>
          <div className="text-center">
            <p className="text-base font-bold text-stone-900 dark:text-stone-100">{stats.posts_count}</p>
            <p className="text-[11px] text-stone-500">Posts</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-mehendi">₹{profile.total_saved_rupees.toFixed(0)}</p>
            <p className="text-[11px] text-stone-500">Saved</p>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowEditProfile(true)}
        className="mt-3 w-full text-center border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 font-semibold py-2 rounded-xl text-sm"
      >
        ✏️ Edit Profile
      </button>

      <div className="mt-3 bg-turmeric text-white rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Sthamly Points</span>
          <span className="text-2xl font-extrabold">🪙 {profile.sthamly_points}</span>
        </div>
        <Link
          href="/bazaar"
          className="mt-2 block text-center bg-white/20 hover:bg-white/30 text-white font-semibold py-2 rounded-xl text-xs"
        >
          Redeem Points in Bazaar →
        </Link>
      </div>

      <button
        onClick={() => setShowDashboard(true)}
        className="mt-4 w-full text-left bg-stone-100 dark:bg-stone-800 rounded-2xl p-4"
      >
        <p className="text-sm font-bold text-stone-900 dark:text-stone-100">Professional dashboard</p>
        <p className="text-xs text-stone-500 mt-0.5">See your insights and tools →</p>
      </button>

      {profile.is_seller && wallet && (
        <div className="mt-3 bg-mehendi text-white rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">🟩 Seller Earnings</span>
            <span className="text-2xl font-extrabold">₹{wallet.seller_earnings.toFixed(0)}</span>
          </div>
          <button
            disabled={wallet.seller_earnings <= 0}
            className="mt-2 block w-full text-center bg-white/20 hover:bg-white/30 disabled:opacity-40 text-white font-semibold py-2 rounded-xl text-xs"
          >
            Withdraw to Bank
          </button>
        </div>
      )}

      {profile.is_seller && wallet && (
        <div className="mt-3 bg-indigobrand text-white rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs opacity-80">Active Plan</span>
              <p className="font-bold">{wallet.is_seller_pro ? '🟦 Seller Pro' : 'Free Plan'}</p>
            </div>
            {!wallet.is_seller_pro && (
              <Link href="/seller-pro" className="bg-white text-indigobrand text-xs font-bold px-3 py-2 rounded-full">
                Upgrade ₹199/mo
              </Link>
            )}
          </div>
          {wallet.is_seller_pro && (
            <p className="text-[11px] opacity-80 mt-1">0% commission + ✓ Verified Badge</p>
          )}
        </div>
      )}

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

      {user && (
        <div className="mt-8">
          <div className="flex gap-1 border-b border-stone-200 dark:border-stone-700">
            <ContentTabButton label="📹 Reels" active={contentTab === 'reels'} onClick={() => setContentTab('reels')} />
            <ContentTabButton label="🏺 Products" active={contentTab === 'products'} onClick={() => setContentTab('products')} />
            <ContentTabButton label="📈 My Ads" active={contentTab === 'ads'} onClick={() => setContentTab('ads')} />
            <ContentTabButton label="🔖 Saved" active={contentTab === 'saved'} onClick={() => setContentTab('saved')} />
          </div>
          <MyContentGrid tab={contentTab} userId={user.id} />
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

      {showEditProfile && profile && (
        <EditProfileSheet
          profile={{
            full_name: profile.full_name,
            username: profile.username,
            bio: profile.bio,
            city: profile.city,
            avatar_url: profile.avatar_url,
            is_private: profile.is_private,
            pronouns: profile.pronouns,
            gender: profile.gender,
          }}
          onClose={() => setShowEditProfile(false)}
          onSaved={() => { setShowEditProfile(false); load() }}
        />
      )}

      {showShareQR && profile.username && (
        <ShareProfileSheet handle={profile.username} onClose={() => setShowShareQR(false)} />
      )}
      {showScanner && <QRScannerSheet onClose={() => setShowScanner(false)} />}
      {showDashboard && <ProfessionalDashboard onClose={() => setShowDashboard(false)} />}
    </div>
  )
}

function ContentTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-center text-xs font-semibold py-2.5 border-b-2 ${
        active ? 'border-clay text-clay' : 'border-transparent text-stone-400'
      }`}
    >
      {label}
    </button>
  )
}

type GridItem = { id: string; title: string; image_url: string | null; status?: string }

function MyContentGrid({ tab, userId }: { tab: ContentTab; userId: string }) {
  const [items, setItems] = useState<GridItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId])

  async function load() {
    setLoading(true)
    if (tab === 'reels') {
      const { data } = await supabase
        .from('lessons')
        .select('id, title, video_url')
        .eq('creator_id', userId)
        .eq('is_user_generated', true)
        .order('created_at', { ascending: false })
      setItems((data || []).map((d: any) => ({ id: d.id, title: d.title, image_url: d.video_url })))
    } else if (tab === 'products') {
      const { data } = await supabase
        .from('products')
        .select('id, title, image_url')
        .eq('maker_id', userId)
        .order('created_at', { ascending: false })
      setItems((data || []) as GridItem[])
    } else if (tab === 'ads') {
      const { data } = await supabase
        .from('ad_campaigns')
        .select('id, status, reel_id')
        .eq('advertiser_id', userId)
        .order('created_at', { ascending: false })
      setItems((data || []).map((d: any) => ({ id: d.id, title: `Campaign — ${d.status}`, image_url: null, status: d.status })))
    } else {
      const { data } = await supabase
        .from('saved_lessons')
        .select('lesson_id, lessons ( id, title, video_url )')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      setItems((data || []).map((d: any) => ({ id: d.lessons?.id, title: d.lessons?.title, image_url: d.lessons?.video_url })))
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete kar dein?')) return
    if (tab === 'reels') {
      await supabase.rpc('delete_lesson', { p_lesson_id: id })
    } else if (tab === 'products') {
      await supabase.from('products').delete().eq('id', id)
    } else if (tab === 'ads') {
      await supabase.from('ad_campaigns').delete().eq('id', id)
    } else {
      await supabase.rpc('toggle_saved_lesson', { p_lesson_id: id })
    }
    load()
  }

  if (loading) return <p className="text-center text-stone-400 text-xs py-8">Loading…</p>
  if (items.length === 0) return <p className="text-center text-stone-400 text-xs py-8">Kuch nahi hai yahan abhi.</p>

  return (
    <div className="grid grid-cols-3 gap-1.5 mt-3">
      {items.map((item) => (
        <div key={item.id} className="relative aspect-square bg-stone-100 rounded-lg overflow-hidden group">
          {item.image_url && tab !== 'reels' && tab !== 'saved' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt="" className="w-full h-full object-cover" />
          ) : item.image_url ? (
            <video src={item.image_url} className="w-full h-full object-cover" muted />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] text-stone-400 p-1 text-center">
              {item.title}
            </div>
          )}
          {tab !== 'saved' && (
            <div className="absolute top-1 right-1 flex gap-1">
              <button
                onClick={() => handleDelete(item.id)}
                className="w-5 h-5 rounded-full bg-black/50 text-white text-[10px] flex items-center justify-center"
              >
                🗑️
              </button>
            </div>
          )}
        </div>
      ))}
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
