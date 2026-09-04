'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import PageSkeleton from '@/components/PageSkeleton'
import {
  Menu, Settings, Moon, Sun, Shield, LogOut, BadgeCheck, QrCode,
  ScanLine, IndianRupee, Coins, Mic,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'
import EditProfileSheet from '@/components/EditProfileSheet'
import ShareProfileSheet from '@/components/ShareProfileSheet'
import QRScannerSheet from '@/components/QRScannerSheet'
import ProfessionalDashboard from '@/components/ProfessionalDashboard'
import MohallaScoreCard from '@/components/MohallaScoreCard'
import SathiStreakCard from '@/components/SathiStreakCard'
import VoicePledgeSheet from '@/components/VoicePledgeSheet'

type Profile = {
  full_name: string | null
  city: string | null
  mohalla: string | null
  sthamly_points: number
  total_saved_rupees: number
  is_seller: boolean
  seller_verified: boolean
  username: string | null
  bio: string | null
  avatar_url: string | null
  is_verified: boolean
  pronouns: string | null
  gender: string | null
}

type Wallet = {
  seller_earnings: number
  is_seller_pro: boolean
  plan_renews_at: string | null
}

type ContentTab = 'listings' | 'auctions'

export default function ProfilePage() {
  const params = useParams()
  const rawParam = params?.userId
  const routeUserId = Array.isArray(rawParam) ? rawParam[0] : (rawParam as string | undefined)

  const { user, loading: authLoading } = useAuth()

  const isOwnProfile = !routeUserId || routeUserId === user?.id
  const targetUserId = routeUserId || user?.id

  const [profile, setProfile] = useState<Profile | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [hasVoicePledge, setHasVoicePledge] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [debugError, setDebugError] = useState('')
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showVoicePledge, setShowVoicePledge] = useState(false)
  const [contentTab, setContentTab] = useState<ContentTab>('listings')

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

    let { data, error } = await supabase
      .from('profiles')
      .select('full_name, city, mohalla, sthamly_points, total_saved_rupees, is_seller, seller_verified, username, bio, avatar_url, is_verified, pronouns, gender')
      .eq('id', targetUserId)
      .single()

    if (error && !data && isOwnProfile) {
      const ensureResult = await supabase.rpc('ensure_profile')
      if (ensureResult.error) setDebugError(`ensure_profile: ${ensureResult.error.message}`)
      const retry = await supabase
        .from('profiles')
        .select('full_name, city, mohalla, sthamly_points, total_saved_rupees, is_seller, seller_verified, username, bio, avatar_url, is_verified, pronouns, gender')
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

      const { data: pledge } = await supabase
        .from('voice_pledges')
        .select('id')
        .eq('seller_id', targetUserId)
        .maybeSingle()
      setHasVoicePledge(!!pledge)

      // Sathi Streak "aaj active hoon" ping — ab yahan hota hai, Home load
      // hote hi nahi, taaki Home halka rahe.
      supabase.rpc('mark_sathi_active_today').then(({ error: rpcError }) => {
        if (rpcError) console.error('sathi streak mark failed:', rpcError)
      })
    }

    setLoading(false)
  }

  async function toggleSellerMode(value: boolean) {
    if (!profile || !isOwnProfile) return
    setSaving(true)
    const prevProfile = profile
    setProfile({ ...profile, is_seller: value })

    const { error } = await supabase.rpc('toggle_role', { p_is_seller: value })
    setSaving(false)

    if (error) {
      setProfile(prevProfile)
      setDebugError('Seller Mode update fail ho gaya: ' + error.message)
      return
    }
    if (value && hasVoicePledge === false) setShowVoicePledge(true)
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
        <h1 className="text-lg font-bold text-stone-900">Aap sign in nahi hain</h1>
        <p className="text-sm text-stone-500 mt-2 mb-6">Points kamane aur apna saamaan list karne ke liye sign in karein.</p>
        <Link href="/login" className="w-full max-w-xs bg-clay text-white font-semibold py-3 rounded-xl text-sm">Sign In</Link>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl mb-3">⚠️</p>
        <h1 className="text-lg font-bold text-stone-900">Profile load nahi ho paya</h1>
        <p className="text-sm text-stone-500 mt-2 mb-6">
          {isOwnProfile
            ? `Aap ${user?.email} se signed in hain, lekin profile data load karne mein dikkat aayi.`
            : 'Ye profile shayad exist nahi karti, ya kuch galat ho gaya.'}
        </p>
        <button onClick={() => load()} className="w-full max-w-xs bg-clay text-white font-semibold py-3 rounded-xl text-sm">Retry</button>
        {isOwnProfile && debugError && <p className="text-[11px] text-red-500 mt-4 max-w-xs break-words">{debugError}</p>}
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto pb-24 px-4 pt-6">
      {/* ---- Header: avatar + identity + primary actions ---- */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-16 h-16 flex-shrink-0 rounded-full overflow-hidden bg-indigobrand-light flex items-center justify-center">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-bold text-indigobrand">{profile.full_name?.[0]?.toUpperCase() || 'R'}</span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-bold text-amber-900">{profile.full_name || (isOwnProfile ? 'Your Profile' : 'Sthamly User')}</h1>
              {profile.pronouns && <span className="text-sm text-stone-400">{profile.pronouns}</span>}
              {profile.is_verified && <BadgeCheck size={18} className="text-sky-500 fill-sky-500/20" />}
            </div>
            {profile.username && <p className="text-xs text-stone-400">@{profile.username}</p>}
            <p className="text-sm text-stone-500">{profile.mohalla ? `${profile.mohalla}, ` : ''}{profile.city}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOwnProfile && (
            <button onClick={() => setShowShareQR(true)} className="text-stone-500 dark:text-stone-300 border border-stone-300 dark:border-stone-600 rounded-full p-1.5" aria-label="Share profile QR">
              <QrCode size={18} />
            </button>
          )}

          {isOwnProfile && (
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
          )}
        </div>
      </div>

      {profile.bio && !isOwnProfile && <p className="text-sm text-stone-600 dark:text-stone-300 mt-3">{profile.bio}</p>}

      {/* ---- Points, front and center as a stat ---- */}
      <Link
        href={isOwnProfile ? '/rewards' : '#'}
        className={`mt-5 flex items-center justify-between border-y border-stone-200 dark:border-stone-700 py-3 ${!isOwnProfile ? 'pointer-events-none' : ''}`}
      >
        <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">Sthamly Points</span>
        <span className="text-lg font-bold text-turmeric flex items-center gap-1">
          <Coins size={16} /> {profile.sthamly_points}
        </span>
      </Link>

      {isOwnProfile && (
        <>
          <div className="mt-3">
            <MohallaScoreCard />
          </div>
          <div className="mt-3">
            <SathiStreakCard />
          </div>
        </>
      )}

      {/* ---- Action row ---- */}
      {isOwnProfile && (
        <div className="flex gap-2 mt-4">
          <button onClick={() => setShowEditProfile(true)} className="flex-1 text-center border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 font-semibold py-2 rounded-xl text-sm">
            Edit Profile
          </button>
          <button onClick={() => setShowShareQR(true)} className="flex-1 text-center border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 font-semibold py-2 rounded-xl text-sm">
            Share Profile
          </button>
        </div>
      )}

      {profile.seller_verified && (
        <div className="mt-3 inline-flex items-center gap-1.5 bg-mehendi-light text-mehendi text-xs font-semibold px-3 py-1.5 rounded-full">
          ✓ Gonda ka Verified Maker
        </div>
      )}

      {isOwnProfile && (
        <>
          {/* ---- Seller Mode toggle ---- */}
          <div className="mt-4 border border-stone-200 dark:border-stone-700 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-sm text-stone-900 dark:text-stone-100">Seller Mode</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Voice card feed aur Boli Board pe apna saamaan bechiye</p>
            </div>
            <button
              disabled={saving}
              onClick={() => toggleSellerMode(!profile.is_seller)}
              className={`w-12 h-7 rounded-full flex-shrink-0 transition-colors relative ${profile.is_seller ? 'bg-clay' : 'bg-stone-300'}`}
            >
              <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full transition-transform ${profile.is_seller ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {profile.is_seller && hasVoicePledge === false && (
            <button
              onClick={() => setShowVoicePledge(true)}
              className="mt-2 w-full flex items-center justify-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl py-2.5"
            >
              <Mic size={14} /> Safety Pledge record karna baaki hai
            </button>
          )}

          {/* ---- Seller Pro dashboard entry ---- */}
          {profile.is_seller && (
            <button onClick={() => setShowDashboard(true)} className="mt-3 w-full flex items-center justify-between text-left border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-bold text-stone-900 dark:text-stone-100">Seller Pro Dashboard</p>
                <p className="text-xs text-stone-500 mt-0.5">Catalog, Voice-Boost aur subscription</p>
              </div>
              <span className="text-stone-300">→</span>
            </button>
          )}

          {/* ---- Earnings + plan ---- */}
          {profile.is_seller && wallet && (
            <div className="relative mt-3 bg-mehendi text-white rounded-2xl p-4 overflow-hidden">
              <div className="relative flex items-center justify-between">
                <span className="font-semibold text-sm">Seller Earnings</span>
                <span className="text-2xl font-extrabold">₹{wallet.seller_earnings.toFixed(0)}</span>
              </div>
              <div className="relative flex items-center justify-between mt-2 pt-2 border-t border-white/20">
                <span className="text-xs opacity-90">{wallet.is_seller_pro ? 'Seller Pro · ₹149/month' : 'Free Plan'}</span>
                {wallet.is_seller_pro ? (
                  <span className="text-[11px] font-semibold flex items-center gap-1"><BadgeCheck size={12} /> Verified Badge</span>
                ) : (
                  <Link href="/seller-pro" className="bg-white text-mehendi text-xs font-bold px-3 py-1.5 rounded-full">Upgrade ₹149/mo</Link>
                )}
              </div>
              <button disabled={wallet.seller_earnings <= 0} className="relative mt-3 block w-full text-center bg-white/20 hover:bg-white/30 disabled:opacity-40 text-white font-semibold py-2 rounded-xl text-xs">
                Withdraw to Bank
              </button>
            </div>
          )}

          <div className="mt-4 flex gap-3">
            {profile.is_seller && <Link href="/sell" className="flex-1 text-center bg-stone-900 text-white font-semibold py-3 rounded-xl text-sm">+ Naya Listing (Photo + Voice)</Link>}
            {profile.is_seller && <Link href="/boli/new" className="flex-1 text-center bg-clay text-white font-semibold py-3 rounded-xl text-sm">🔨 Nayi Boli Shuru Karein</Link>}
          </div>
        </>
      )}

      {/* ---- Content: My Listings / My Auctions — no more Reels/Ads/Saved ---- */}
      {profile.is_seller && (
        <div className="mt-8">
          <div className="flex gap-1 border-b border-stone-200 dark:border-stone-700">
            <ContentTabButton label="Listings" active={contentTab === 'listings'} onClick={() => setContentTab('listings')} />
            <ContentTabButton label="My Auctions" active={contentTab === 'auctions'} onClick={() => setContentTab('auctions')} />
          </div>
          <MyContentGrid tab={contentTab} userId={targetUserId} isOwnProfile={isOwnProfile} />
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-3 text-[11px] text-stone-400">
        <Link href="/terms" className="underline">Terms &amp; Conditions</Link>
        <span>·</span>
        <Link href="/privacy" className="underline">Privacy Policy</Link>
      </div>

      {isOwnProfile && showEditProfile && profile && (
        <EditProfileSheet
          profile={{
            full_name: profile.full_name, username: profile.username, bio: profile.bio, city: profile.city,
            avatar_url: profile.avatar_url, pronouns: profile.pronouns, gender: profile.gender,
          }}
          onClose={() => setShowEditProfile(false)}
          onSaved={() => { setShowEditProfile(false); load() }}
        />
      )}

      {isOwnProfile && showShareQR && profile.username && <ShareProfileSheet handle={profile.username} onClose={() => setShowShareQR(false)} />}
      {isOwnProfile && showScanner && <QRScannerSheet onClose={() => setShowScanner(false)} />}
      {isOwnProfile && showDashboard && <ProfessionalDashboard onClose={() => setShowDashboard(false)} />}
      {isOwnProfile && showVoicePledge && (
        <VoicePledgeSheet onClose={() => setShowVoicePledge(false)} onSaved={() => { setShowVoicePledge(false); setHasVoicePledge(true) }} />
      )}
    </div>
  )
}

function ContentTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex-1 text-center text-xs font-semibold py-2.5 border-b-2 ${active ? 'border-clay text-clay' : 'border-transparent text-stone-400'}`}>
      {label}
    </button>
  )
}

type GridItem = { id: string; title: string; image_url: string | null; subtitle?: string }

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
    if (tab === 'listings') {
      const { data } = await supabase
        .from('products')
        .select('id, title, image_url, price')
        .eq('maker_id', userId)
        .order('created_at', { ascending: false })
      setItems((data || []).map((d: any) => ({ id: d.id, title: d.title, image_url: d.image_url, subtitle: `₹${d.price}` })))
    } else {
      const { data } = await supabase
        .from('auctions')
        .select('id, status, current_highest_bid, base_price, products ( title, image_url )')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false })
      setItems((data || []).map((d: any) => ({
        id: d.id,
        title: d.products?.title || 'Boli',
        image_url: d.products?.image_url || null,
        subtitle: `${d.status} · ₹${d.current_highest_bid ?? d.base_price}`,
      })))
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!isOwnProfile || deletingId) return
    if (!confirm('Delete kar dein?')) return
    setActionError('')
    setDeletingId(id)

    const table = tab === 'listings' ? 'products' : 'auctions'
    const ownerCol = tab === 'listings' ? 'maker_id' : 'seller_id'
    const { error } = await supabase.from(table).delete().eq('id', id).eq(ownerCol, userId)

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
        <div className="grid grid-cols-3 gap-0.5 mt-3">
          {items.map((item) => (
            <div key={item.id} className="relative aspect-square bg-stone-100 overflow-hidden group">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-stone-400 p-1 text-center">{item.title}</div>
              )}
              {item.subtitle && (
                <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded">{item.subtitle}</span>
              )}
              {isOwnProfile && (
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white text-[10px] flex items-center justify-center disabled:opacity-50"
                >
                  {deletingId === item.id ? '…' : '🗑️'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
