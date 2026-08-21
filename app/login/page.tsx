'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

export default function LoginPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [consent, setConsent] = useState(false)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Surface any error Supabase/Google put in the URL after a failed
    // redirect (e.g. #error=..&error_description=..), instead of
    // silently landing back on the login form with no explanation.
    if (typeof window === 'undefined') return
    const hash = new URLSearchParams(window.location.hash.replace('#', ''))
    const search = new URLSearchParams(window.location.search)
    const desc = hash.get('error_description') || search.get('error_description')
    if (desc) setError(decodeURIComponent(desc.replace(/\+/g, ' ')))
  }, [])

  useEffect(() => {
    // Already signed in (e.g. just landed back here after Google auth
    // resolved) — bounce straight to the profile instead of showing the
    // login form again.
    if (!authLoading && user) {
      router.replace('/profile')
    }
  }, [authLoading, user, router])

  async function handleEmailLogin() {
    setError('')
    if (!consent) {
      setError('Aage badhne ke liye data-use consent box check karo.')
      return
    }
    if (!email) {
      setError('Apna email daalo.')
      return
    }
    setSending(true)

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        data: { full_name: fullName || undefined },
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    })

    setSending(false)

    if (authError) {
      setError(authError.message)
      return
    }
    setSent(true)
  }

  async function handleGoogleLogin() {
    setError('')
    if (!consent) {
      setError('Aage badhne ke liye data-use consent box check karo.')
      return
    }
    setGoogleLoading(true)
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    })
    if (authError) {
      setError(authError.message)
      setGoogleLoading(false)
    }
    // On success, Supabase redirects to Google — no further action needed here.
  }

  if (authLoading) {
    return <div className="p-6 text-center text-stone-500">Loading…</div>
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl mb-3">📩</p>
        <h1 className="text-lg font-bold text-stone-900">Check your email</h1>
        <p className="text-sm text-stone-500 mt-2">
          {email} pe ek sign-in link bheja hai. Us link pe tap karke wapas aa jao — turant login ho jaoge.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-dvh flex flex-col items-center justify-center px-6">
      <h1 className="text-3xl font-heading font-semibold text-clay">
        Sthamly
      </h1>
      <p className="text-sm text-stone-500 mt-1">सीखो ➔ बनाओ ➔ लोकल बेचो</p>
      <p className="text-xs text-stone-400 mt-2 mb-6 text-center">
        Naya account bana rahe ho ya pehle se ho — bas neeche se continue karo,
        Sthamly khud pehchan lega. Koi alag &quot;Sign Up&quot; form nahi bharna padta.
      </p>

      <div className="w-full space-y-3">
        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2 border border-stone-300 rounded-xl py-3 text-sm font-semibold text-stone-700 disabled:opacity-50"
        >
          <GoogleIcon />
          {googleLoading ? 'Redirecting…' : 'Continue with Google (Sign in / Sign up)'}
        </button>

        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-stone-200" />
          <span className="text-xs text-stone-400">or email se</span>
          <div className="flex-1 h-px bg-stone-200" />
        </div>

        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your name (naya account ke liye)"
          className="w-full border border-stone-300 rounded-xl px-4 py-3 text-sm"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full border border-stone-300 rounded-xl px-4 py-3 text-sm"
        />

        <label className="flex items-start gap-2.5 pt-1">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 flex-shrink-0"
          />
          <span className="text-[11px] text-stone-500 leading-snug">
            मैं सहमति देता/देती हूं कि मेरा नाम, ईमेल और शहर Sthamly की Learn &amp; Earn और Local
            Bazaar सेवाएं देने के लिए इस्तेमाल किया जाए, जैसा{' '}
            <Link href="/privacy" className="text-clay underline">Privacy Policy</Link> में
            बताया गया है। I agree to the{' '}
            <Link href="/terms" className="text-clay underline">Terms</Link>.
          </span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleEmailLogin}
          disabled={sending}
          className="w-full bg-clay text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50"
        >
          {sending ? 'Sending link…' : 'Continue with Email (Sign in / Sign up)'}
        </button>
      </div>

      <p className="text-[11px] text-stone-400 mt-6 text-center">
        No password needed — we&apos;ll email you a one-tap sign-in link.
      </p>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4c-7.6 0-14.2 4.3-17.7 10.7z"/>
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-1.8 14-5l-6.5-5.5c-2 1.4-4.6 2.3-7.5 2.3-5.3 0-9.7-3.4-11.3-8.1l-6.6 5C9.7 39.6 16.3 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4 5.7l6.5 5.5C41.9 35.6 44 30.2 44 24c0-1.3-.1-2.7-.4-3.5z"/>
    </svg>
  )
}
