'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageSkeleton from '@/components/PageSkeleton'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

type NotifPrefs = { reward: boolean; order: boolean; social: boolean; learning: boolean }

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const [fullName, setFullName] = useState('')
  const [city, setCity] = useState('')
  const [language, setLanguage] = useState('hi-en')
  const [prefs, setPrefs] = useState<NotifPrefs>({ reward: true, order: true, social: true, learning: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isBusiness, setIsBusiness] = useState(false)

  useEffect(() => {
    if (authLoading || !user) { setLoading(false); return }
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, city, language, notification_prefs, is_business')
        .eq('id', user!.id)
        .single()
      if (data) {
        setFullName(data.full_name || '')
        setCity(data.city || '')
        setLanguage(data.language || 'hi-en')
        setPrefs(data.notification_prefs || { reward: true, order: true, social: true, learning: true })
        setIsBusiness(data.is_business || false)
      }
      setLoading(false)
    }
    load()
  }, [authLoading, user])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    await supabase.rpc('update_profile_settings', {
      p_full_name: fullName,
      p_city: city,
      p_notification_prefs: prefs,
      p_language: language,
    })
    await supabase.rpc('set_business_mode', { p_enabled: isBusiness })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading || authLoading) return <PageSkeleton rows={1} />

  if (!user) {
    return (
      <div className="max-w-md mx-auto min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-bold text-stone-900">Sign in to view settings</p>
        <Link href="/login" className="mt-4 bg-clay text-white font-semibold py-3 px-6 rounded-xl text-sm">
          Sign In
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto pb-24 min-h-dvh">
      <header className="sticky top-0 bg-white/95 backdrop-blur px-4 py-3 border-b border-stone-100 z-10 flex items-center gap-3">
        <Link href="/profile"><ArrowLeft size={22} className="text-stone-800" /></Link>
        <span className="text-sm font-semibold text-stone-900">Settings</span>
      </header>

      <div className="px-4 pt-5 space-y-6">
        {/* Account */}
        <section>
          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-2">Account</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold text-stone-800">Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-stone-800">City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm mt-1"
              />
            </div>
          </div>
        </section>

        {/* Language */}
        <section>
          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-2">Language</h2>
          <div className="flex gap-2">
            {[
              { value: 'hi-en', label: 'हिंदी + English' },
              { value: 'hi', label: 'सिर्फ हिंदी' },
              { value: 'en', label: 'English only' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLanguage(opt.value)}
                className={`flex-1 text-xs font-semibold py-2 rounded-xl border ${
                  language === opt.value ? 'bg-clay text-white border-clay' : 'border-stone-300 text-stone-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-stone-400 mt-1.5">
            Saves your preference — full app translation is being rolled out screen by screen.
          </p>
        </section>

        {/* Business Mode */}
        <section>
          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-2">Business Account</h2>
          <div className="bg-white border border-stone-200 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-800">🏢 Business Mode</p>
              <p className="text-[11px] text-stone-500">Post campaigns, find local creators for your brand</p>
            </div>
            <button
              onClick={() => setIsBusiness(!isBusiness)}
              className={`w-11 h-6 rounded-full flex-shrink-0 relative transition-colors ${isBusiness ? 'bg-clay' : 'bg-stone-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${isBusiness ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-2">Notifications</h2>
          <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
            <NotifRow
              icon="🪙"
              label="Rewards"
              desc="Coins earned, discounts redeemed"
              checked={prefs.reward}
              onChange={(v) => setPrefs({ ...prefs, reward: v })}
            />
            <NotifRow
              icon="📦"
              label="Orders & Bookings"
              desc="Booking status, purchase updates"
              checked={prefs.order}
              onChange={(v) => setPrefs({ ...prefs, order: v })}
            />
            <NotifRow
              icon="💬"
              label="Social"
              desc="New messages, follows, comments"
              checked={prefs.social}
              onChange={(v) => setPrefs({ ...prefs, social: v })}
            />
            <NotifRow
              icon="📚"
              label="Learning"
              desc="New lessons, quiz reminders"
              checked={prefs.learning}
              onChange={(v) => setPrefs({ ...prefs, learning: v })}
            />
          </div>
        </section>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-clay text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

function NotifRow({
  icon, label, desc, checked, onChange,
}: { icon: string; label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-lg">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-800">{label}</p>
          <p className="text-[11px] text-stone-500">{desc}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full flex-shrink-0 relative transition-colors ${checked ? 'bg-clay' : 'bg-stone-300'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}
