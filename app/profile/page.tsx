'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import PageSkeleton from '@/components/PageSkeleton'
import {
  Menu, Settings, Moon, Sun, Shield, LogOut, BadgeCheck, QrCode,
  ScanLine, Lock, BookOpen, Hammer, IndianRupee, CheckCircle2,
} from 'lucide-react'
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
type FollowStatus = 'none' | 'requested' | 'accepted'

// ---- Level ladder — replaces a flat points number with a named growth stage ----
const LEVELS = [
  { min: 0, label: 'Naya Seekhne Wala', next: 150 },
  { min: 150, label: 'Sikhaane Wala', next: 500 },
  { min: 500, label: 'Karigar', next: 1000 },
  { min: 1000, label: 'Ustad', next: null as number | null },
]

function getLevelInfo(points: number) {
  let current = LEVELS[0]
  for (const lvl of LEVELS) {
    if (points >= lvl.min) current = lvl
  }
  const idx = LEVELS.indexOf(current)
  const progressPct = current.next
    ? Math.min(100, Math.round(((points - current.min) / (current.next - current.min)) * 100))
    : 100
  return { label: current.label, levelNumber: idx + 1, next: current.next, progressPct }
}

export default function ProfilePage() {
  const params = useParams()
  const rawParam = params?.userId
  const routeUserId = Array.isArray(rawParam) ? rawParam[0] : (rawParam as string | undefined)

  const { user, loading: authLoading } = useAuth()

  const isOwnProfile = !routeUserId || routeUserId === user?.id
  const targetUserId = routeUserId || user?.id

  const [profile, setProfile] = useState<Profile | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [debugError, setDebugError] = useState('')
  const [showIdentitySetup, setShowIdentitySetup] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [contentTab, setContentTab] = useState<ContentTab>('reels')

  const [followStatus, setFollowStatus] = useState<FollowStatus>('none')
  const [followBusy, setFollowBusy] = useState(false)
  const [followError, setFollowError] = useState('')

  const [menuOpen, setMenuOpen] = useState(false)
  const [isDark, setIsDark] = useState(false)

  const [showShareQR, setShowShareQR] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sthamly-theme')
    const prefersDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
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
    if (!targetUserId) { setProfile(null); setLoading(false); return }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, targetUserId, isOwnProfile])

  async function load() {
    if (!targetUserId) return
    setLoading(true)
    setDebugError('')
    setFollowError('')

    let { data, error } = await supabase
      .from('profiles')
      .select('full_name, city, sthamly_points, total_saved_rupees, is_seller, is_creator, seller_verified, skill_badges, username, bio, avatar_url, is_verified, is_private, pronouns, gender')
      .eq('id', targetUserId)
      .single()

    if (error && !data && isOwnProfile) {
      const ensureResult = await supabase.rpc('ensure_profile')
      if (ensureResult.error) setDebugError(`ensure_profile: ${ensureResult.error.message}`)
      const retry = await supabase
        .from('profiles')
        .select('full_name, city, sthamly_points, total_saved_rupees, is_seller, is_creator, seller_verified, skill_badges, username, bio, avatar_url, is_verified, is_private, pronouns, gender')
        .eq('id', targetUserId)
        .single()
      data = retry.data
      if (retry.error && !data) setDebugError((prev) => prev + ` | re-select: ${retry.error.message}`)
    } else if (error && !data) {
      setDebugError(error.message)
    }

    if (data) setProfile(data as Profile)

    if (isOwnProfile) {
      const { data: walletData, error: walletError } = await supabase.rpc('get_wallet_summary')
      if (walletError) console.error('get_wallet_summary error:', walletError)
      else if (walletData) setWallet(walletData as Wallet)
    }

    const { data: statsData, error: statsError } = await supabase.rpc('get_profile_stats', { p_user_id: targetUserId })
    if (statsError) console.error('get_profile_stats error:', statsError)
    else if (statsData) setStats(statsData as Stats)

    if (!isOwnProfile && user) {
      const { data: followData, error: followFetchError } = await supabase
        .from('follows')
        .select('status')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle()
      if (!followFetchError) setFollowStatus((followData?.status as FollowStatus) || 'none')
    }

    setLoading(false)
  }

  async function toggleRole(field: 'is_seller' | 'is_creator', value: boolean) {
    if (!profile || !isOwnProfile) return
    setSaving(true)
    const prevProfile = profile
    const next = { ...profile, [field]: value }
    setProfile(next)

    const { error } = await supabase.rpc('toggle_role', { p_is_seller: next.is_seller, p_is_creator: next.is_creator })
    setSaving(false)

    if (error) {
      setProfile(prevProfile)
      setDebugError('Role update fail ho gaya: ' + error.message)
      return
    }
    if (field === 'is_creator' && value && !prevProfile.username) setShowIdentitySetup(true)
  }

  async function handleFollowToggle() {
    if (!user || !targetUserId || followBusy) return
    setFollowError('')
    setFollowBusy(true)
    const { data, error } = await supabase.rpc('toggle_follow', { p_target_user_id: targetUserId })
    setFollowBusy(false)

    if (error) {
      setFollowError('Follow action fail ho gaya: ' + error.message)
      return
    }
    setFollowStatus((data as FollowStatus) ?? 'none')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading || authLoading) return <PageSkeleton rows={1} />

  if (!targetUserId) {
    return (
      <div className="max-w-md mx-auto min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl mb-3">👤</p>
        <h1 className="text-lg font-bold text-stone-900">You&apos;re not signed in</h1>
        <p className="text-sm text-stone-500 mt-2 mb-6">Sign in to earn points, upload reels, and list your products.</p>
        <Link href="/login" className="w-full max-w-xs bg-clay text-white font-semibold py-3 rounded-xl text-sm">Sign In</Link>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl mb-3">⚠️</p>
        <h1 className="text-lg font-bold text-stone-900">{isOwnProfile ? "Couldn't load your profile" : "Couldn't load this profile"}</h1>
        <p className="text-sm text-stone-500 mt-2 mb-6">
          {isOwnProfile
            ? `You're signed in as ${user?.email}, but something went wrong loading your profile data. Try again in a moment.`
            : 'This profile might not exist, or something went wrong. Try again.'}
        </p>
        <button onClick={() => load()} className="w-full max-w-xs bg-clay text-white font-semibold py-3 rounded-xl text-sm">Retry</button>
        {isOwnProfile && debugError && <p className="text-[11px] text-red-500 mt-4 max-w-xs break-words">{debugError}</p>}
      </div>
    )
  }

  const canSeeContent = isOwnProfile || !profile.is_private || followStatus === 'accepted'
  const levelInfo = getLevelInfo(profile.sthamly_points)

  // Journey stages derived from real signals already on the profile/wallet — no fake data.
  const seekhoDone = profile.sthamly_points > 0
  const banaoDone = profile.is_creator || profile.is_seller
  const kamaoDone = (wallet?.seller_earnings ?? 0) > 0 || profile.seller_verified

  return (
    <div className="max-w-md mx-auto pb-24 px-4 pt-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar with an XP ring instead of a plain circle */}
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
              <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="4" className="text-stone-200 dark:text-stone-700" />
              <circle
                cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"
                className="text-clay"
                strokeDasharray={2 * Math.PI * 29}
                strokeDashoffset={2 * Math.PI * 29 * (1 - levelInfo.progressPct / 100)}
              />
            </svg>
            <div className="absolute inset-[5px] rounded-full overflow-hidden bg-indigobrand-light flex items-center justify-center">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-indigobrand">{profile.full_name?.[0]?.toUpperCase() || 'R'}</span>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-bold text-amber-900">{profile.full_name || (isOwnProfile ? 'Your Profile' : 'Sthamly User')}</h1>
              {profile.pronouns && <span className="text-sm text-stone-400">{profile.pronouns}</span>}
              {profile.is_verified && <BadgeCheck size={18} className="text-sky-500 fill-sky-500/20" />}
            </div>
            {profile.username && <p className="text-xs text-stone-400">@{profile.username}</p>}
            <p className="text-sm text-stone-500">{profile.city}</p>
            <p className="text-[11px] font-semibold text-clay mt-0.5">Lvl {levelInfo.levelNumber} · {levelInfo.label}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOwnProfile && (
            <button onClick={() => setShowShareQR(true)} className="text-stone-500 dark:text-stone-300 border border-stone-300 dark:border-stone-600 rounded-full p-1.5" aria-label="Share profile QR">
              <QrCode size={18} />
            </button>
          )}

          {isOwnProfile ? (
            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)} className="text-stone-500 dark:text-stone-300 border border-stone-300 dark:border-stone-600 rounded-full p-1.5" aria-label="Menu">
                <Menu size={18} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-9 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-lg py-1 z-20 min-w-[180px]">
                    <Link href="/settings" onClick={() => setMenuOpen(false)} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700">
                      <Settings size={16} /> Settings
                    </Link>
                    <Link href="/settings/privacy" onClick={() => setMenuOpen(false)} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700">
                      <Shield size={16} /> Privacy
                    </Link>
                    <button onClick={() => { setMenuOpen(false); setShowScanner(true) }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700">
                      <ScanLine size={16} /> Scan QR Code
                    </button>
                    <button onClick={toggleDarkMode} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700">
                      {isDark ? <Sun size={16} /> : <Moon size={16} />} {isDark ? 'Light Mode' : 'Dark Mode'}
                    </button>
                    {!profile.is_verified && (
                      <Link href="/verify" onClick={() => setMenuOpen(false)} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700">
                        <BadgeCheck size={16} /> Apply for Verified Badge
                      </Link>
                    )}
                    <div className="my-1 border-t border-stone-100 dark:border-stone-700" />
                    <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
                      <LogOut size={16} /> Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : user ? (
            <button
              onClick={handleFollowToggle}
              disabled={followBusy}
              className={`text-xs font-bold px-4 py-2 rounded-full disabled:opacity-50 ${
                followStatus === 'accepted' || followStatus === 'requested' ? 'bg-stone-100 text-stone-600' : 'bg-clay text-white'
              }`}
            >
              {followStatus === 'accepted' ? 'Following' : followStatus === 'requested' ? 'Requested' : 'Follow'}
            </button>
          ) : (
            <Link href="/login" className="text-xs font-bold px-4 py-2 rounded-full bg-clay text-white">Follow</Link>
          )}
        </div>
      </div>

      {followError && <p className="text-xs text-red-500 mt-2">{followError}</p>}
      {profile.bio && !isOwnProfile && <p className="text-sm text-stone-600 dark:text-stone-300 mt-3">{profile.bio}</p>}

      {/* ---- Journey Stepper: Seekho → Banao → Kamao ---- */}
      <div className="mt-5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-4">
        <p className="text-xs font-semibold text-stone-400 mb-3">
          {isOwnProfile ? 'Aapki Journey' : `${profile.full_name?.split(' ')[0] || 'Inki'} ki Journey`}
        </p>
        <div className="flex items-center">
          <JourneyStep icon={<BookOpen size={16} />} label="Seekho" done={seekhoDone} />
          <JourneyLine done={seekhoDone && banaoDone} />
          <JourneyStep icon={<Hammer size={16} />} label="Banao" done={banaoDone} />
          <JourneyLine done={banaoDone && kamaoDone} />
          <JourneyStep icon={<IndianRupee size={16} />} label="Kamao" done={kamaoDone} />
        </div>
        {levelInfo.next && (
          <div className="mt-4">
            <div className="flex justify-between text-[10px] text-stone-400 mb-1">
              <span>{profile.sthamly_points} pts</span>
              <span>{levelInfo.next} pts se agla level</span>
            </div>
            <div className="h-1.5 rounded-full bg-stone-100 dark:bg-stone-700 overflow-hidden">
              <div className="h-full bg-turmeric rounded-full" style={{ width: `${levelInfo.progressPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {stats && (
        <div className="flex items-center gap-5 mt-4">
          <Link href={`/followers/${targetUserId}?mode=followers`} className="text-center">
            <p className="text-base font-bold text-stone-900 dark:text-stone-100">{stats.followers_count}</p>
            <p className="text-[11px] text-stone-500">Followers</p>
          </Link>
          <Link href={`/followers/${targetUserId}?mode=following`} className="text-center">
            <p className="text-base font-bold text-stone-900 dark:text-stone-100">{stats.following_count}</p>
            <p className="text-[11px] text-stone-500">Following</p>
          </Link>
          <div className="text-center">
            <p className="text-base font-bold text-stone-900 dark:text-stone-100">{stats.posts_count}</p>
            <p className="text-[11px] text-stone-500">Posts</p>
          </div>
          {isOwnProfile && (
            <div className="text-center">
              <p className="text-base font-bold text-mehendi">₹{(profile.total_saved_rupees || 0).toFixed(0)}</p>
              <p className="text-[11px] text-stone-500">Saved</p>
            </div>
          )}
        </div>
      )}

      {isOwnProfile && (
        <>
          <button onClick={() => setShowEditProfile(true)} className="mt-3 w-full text-center border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 font-semibold py-2 rounded-xl text-sm">
            ✏️ Edit Profile
          </button>

          <button onClick={() => setShowDashboard(true)} className="mt-4 w-full text-left bg-stone-100 dark:bg-stone-800 rounded-2xl p-4">
            <p className="text-sm font-bold text-stone-900 dark:text-stone-100">Professional dashboard</p>
            <p className="text-xs text-stone-500 mt-0.5">See your insights and tools →</p>
          </button>

          {profile.is_seller && wallet && (
            <div className="mt-3 bg-mehendi text-white rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">🟩 Seller Earnings</span>
                <span className="text-2xl font-extrabold">₹{wallet.seller_earnings.toFixed(0)}</span>
              </div>
              <button disabled={wallet.seller_earnings <= 0} className="mt-2 block w-full text-center bg-white/20 hover:bg-white/30 disabled:opacity-40 text-white font-semibold py-2 rounded-xl text-xs">
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
                  <Link href="/seller-pro" className="bg-white text-indigobrand text-xs font-bold px-3 py-2 rounded-full">Upgrade ₹199/mo</Link>
                )}
              </div>
              {wallet.is_seller_pro && <p className="text-[11px] opacity-80 mt-1">0% commission + ✓ Verified Badge</p>}
            </div>
          )}
        </>
      )}

      {profile.seller_verified && (
        <div className="mt-3 inline-flex items-center gap-1.5 bg-mehendi-light text-mehendi text-xs font-semibold px-3 py-1.5 rounded-full">
          ✓ Gonda ka Verified Maker
        </div>
      )}

      {isOwnProfile && (
        <div className="mt-6 bg-white dark:bg-stone-800 border border-amber-100 dark:border-stone-700 rounded-2xl p-4 space-y-4">
          <RoleToggle label="🛍️ Seller Mode" description="List your handmade products in the Local Bazaar" checked={profile.is_seller} disabled={saving} onChange={(v) => toggleRole('is_seller', v)} />
          <RoleToggle label="🎥 Creator Mode" description="Upload your own 1-min reels and tag your products" checked={profile.is_creator} disabled={saving} onChange={(v) => toggleRole('is_creator', v)} />
        </div>
      )}

      {isOwnProfile && (
        <div className="mt-4 flex gap-3">
          {profile.is_seller && <Link href="/sell" className="flex-1 text-center bg-stone-900 text-white font-semibold py-3 rounded-xl text-sm">+ List a Product</Link>}
          {profile.is_creator && <Link href="/upload" className="flex-1 text-center bg-clay text-white font-semibold py-3 rounded-xl text-sm">+ Upload a Reel</Link>}
        </div>
      )}

      {/* ---- Skill Growth Timeline — connected path instead of a badge grid ---- */}
      {profile.skill_badges?.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-3">Skill Growth</h2>
          <div className="flex gap-0 overflow-x-auto no-scrollbar pb-2">
            {profile.skill_badges.map((badge, i) => (
              <div key={badge} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center w-20">
                  <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-sm font-bold">
                    {i + 1}
                  </div>
                  <p className="text-[10px] text-center text-stone-500 mt-1 leading-tight">{badge}</p>
                </div>
                {i < profile.skill_badges.length - 1 && <div className="w-6 h-0.5 bg-amber-200 -mt-5" />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        {!canSeeContent ? (
          <div className="flex flex-col items-center justify-center py-14 text-center border-t border-stone-200 dark:border-stone-700">
            <Lock size={28} className="text-stone-400 mb-2" />
            <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">This account is private</p>
            <p className="text-xs text-stone-400 mt-1">Follow to see their reels and products.</p>
          </div>
        ) : (
          <>
            <div className="flex gap-1 border-b border-stone-200 dark:border-stone-700">
              <ContentTabButton label="📹 Reels" active={contentTab === 'reels'} onClick={() => setContentTab('reels')} />
              <ContentTabButton label="🏺 Products" active={contentTab === 'products'} onClick={() => setContentTab('products')} />
              {isOwnProfile && <ContentTabButton label="📈 My Ads" active={contentTab === 'ads'} onClick={() => setContentTab('ads')} />}
              {isOwnProfile && <ContentTabButton label="🔖 Saved" active={contentTab === 'saved'} onClick={() => setContentTab('saved')} />}
            </div>
            <MyContentGrid tab={contentTab} userId={targetUserId} isOwnProfile={isOwnProfile} />
          </>
        )}
      </div>

      <div className="mt-8 flex items-center justify-center gap-3 text-[11px] text-stone-400">
        <Link href="/terms" className="underline">Terms &amp; Conditions</Link>
        <span>·</span>
        <Link href="/privacy" className="underline">Privacy Policy</Link>
      </div>

      {isOwnProfile && showIdentitySetup && (
        <CreatorIdentitySetup onClose={() => setShowIdentitySetup(false)} onSaved={() => { setShowIdentitySetup(false); load() }} />
      )}

      {isOwnProfile && showEditProfile && profile && (
        <EditProfileSheet
          profile={{
            full_name: profile.full_name, username: profile.username, bio: profile.bio, city: profile.city,
            avatar_url: profile.avatar_url, is_private: profile.is_private, pronouns: profile.pronouns, gender: profile.gender,
          }}
          onClose={() => setShowEditProfile(false)}
          onSaved={() => { setShowEditProfile(false); load() }}
        />
      )}

      {isOwnProfile && showShareQR && profile.username && <ShareProfileSheet handle={profile.username} onClose={() => setShowShareQR(false)} />}
      {isOwnProfile && showScanner && <QRScannerSheet onClose={() => setShowScanner(false)} />}
      {isOwnProfile && showDashboard && <ProfessionalDashboard onClose={() => setShowDashboard(false)} />}
    </div>
  )
}

function JourneyStep({ icon, label, done }: { icon: React.ReactNode; label: string; done: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${done ? 'bg-clay text-white' : 'bg-stone-100 text-stone-400 dark:bg-stone-700'}`}>
        {done ? <CheckCircle2 size={18} /> : icon}
      </div>
      <p className={`text-[10px] font-semibold ${done ? 'text-clay' : 'text-stone-400'}`}>{label}</p>
    </div>
  )
}

function JourneyLine({ done }: { done: boolean }) {
  return <div className={`flex-1 h-0.5 mb-4 ${done ? 'bg-clay' : 'bg-stone-200 dark:bg-stone-700'}`} />
}

function ContentTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex-1 text-center text-xs font-semibold py-2.5 border-b-2 ${active ? 'border-clay text-clay' : 'border-transparent text-stone-400'}`}>
      {label}
    </button>
  )
}

type GridItem = { id: string; title: string; image_url: string | null; status?: string }

function MyContentGrid({ tab, userId, isOwnProfile }: { tab: ContentTab; userId: string; isOwnProfile: boolean }) {
  const [items, setItems] = useState<GridItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId])

  async function load() {
    setLoading(true)
    setActionError('')
    if (tab === 'reels') {
      const { data } = await supabase.from('lessons').select('id, title, video_url').eq('creator_id', userId).eq('is_user_generated', true).order('created_at', { ascending: false })
      setItems((data || []).map((d: any) => ({ id: d.id, title: d.title, image_url: d.video_url })))
    } else if (tab === 'products') {
      const { data } = await supabase.from('products').select('id, title, image_url').eq('maker_id', userId).order('created_at', { ascending: false })
      setItems((data || []) as GridItem[])
    } else if (tab === 'ads' && isOwnProfile) {
      const { data } = await supabase.from('ad_campaigns').select('id, status, reel_id').eq('advertiser_id', userId).order('created_at', { ascending: false })
      setItems((data || []).map((d: any) => ({ id: d.id, title: `Campaign — ${d.status}`, image_url: null, status: d.status })))
    } else if (tab === 'saved' && isOwnProfile) {
      const { data } = await supabase.from('saved_lessons').select('lesson_id, lessons ( id, title, video_url )').eq('user_id', userId).order('created_at', { ascending: false })
      setItems((data || []).map((d: any) => ({ id: d.lessons?.id, title: d.lessons?.title, image_url: d.lessons?.video_url })).filter((item: GridItem) => !!item.id))
    } else {
      setItems([])
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!isOwnProfile || deletingId) return
    if (!confirm('Delete kar dein?')) return
    setActionError('')
    setDeletingId(id)

    let error = null
    if (tab === 'reels') { ;({ error } = await supabase.rpc('delete_lesson', { p_lesson_id: id })) }
    else if (tab === 'products') { ;({ error } = await supabase.from('products').delete().eq('id', id).eq('maker_id', userId)) }
    else if (tab === 'ads') { ;({ error } = await supabase.from('ad_campaigns').delete().eq('id', id).eq('advertiser_id', userId)) }
    else { ;({ error } = await supabase.rpc('toggle_saved_lesson', { p_lesson_id: id })) }

    setDeletingId(null)
    if (error) { setActionError('Delete nahi ho paya: ' + error.message); return }
    load()
  }

  if (loading) return <p className="text-center text-stone-400 text-xs py-8">Loading…</p>

  return (
    <>
      {actionError && <p className="text-center text-red-500 text-xs py-2">{actionError}</p>}
      {items.length === 0 ? (
        <p className="text-center text-stone-400 text-xs py-8">Kuch nahi hai yahan abhi.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 mt-3">
          {items.map((item) => (
            <div key={item.id} className="relative aspect-square bg-stone-100 rounded-lg overflow-hidden group">
              {item.image_url && tab !== 'reels' && tab !== 'saved' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_url} alt="" className="w-full h-full object-cover" />
              ) : item.image_url ? (
                <video src={item.image_url} className="w-full h-full object-cover" muted />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-stone-400 p-1 text-center">{item.title}</div>
              )}
              {isOwnProfile && tab !== 'saved' && (
                <div className="absolute top-1 right-1 flex gap-1">
                  <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id} className="w-5 h-5 rounded-full bg-black/50 text-white text-[10px] flex items-center justify-center disabled:opacity-50">
                    {deletingId === item.id ? '…' : '🗑️'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function RoleToggle({ label, description, checked, disabled, onChange }: { label: string; description: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="font-semibold text-sm text-stone-900 dark:text-stone-100">{label}</p>
        <p className="text-xs text-stone-500 dark:text-stone-400">{description}</p>
      </div>
      <button disabled={disabled} onClick={() => onChange(!checked)} className={`w-12 h-7 rounded-full flex-shrink-0 transition-colors relative ${checked ? 'bg-clay' : 'bg-stone-300'}`}>
        <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}