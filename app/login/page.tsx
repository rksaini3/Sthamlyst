'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    setError('')
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

  if (sent) {
    return (
      <div className="max-w-md mx-auto min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl mb-3">📩</p>
        <h1 className="text-lg font-bold text-stone-900">Check your email</h1>
        <p className="text-sm text-stone-500 mt-2">
          {email} pe ek sign-in link bheja hai. Us link pe tap karke wapas aa jao — turant login ho jaoge.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col items-center justify-center px-6">
      <h1 className="text-3xl font-extrabold text-amber-800" style={{ fontFamily: 'cursive' }}>
        Sthamly
      </h1>
      <p className="text-sm text-stone-500 mt-1 mb-8">सीखो ➔ बनाओ ➔ लोकल बेचो</p>

      <div className="w-full space-y-3">
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your name"
          className="w-full border border-stone-300 rounded-xl px-4 py-3 text-sm"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full border border-stone-300 rounded-xl px-4 py-3 text-sm"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleLogin}
          disabled={sending}
          className="w-full bg-amber-600 text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50"
        >
          {sending ? 'Sending link…' : 'Continue with Email'}
        </button>
      </div>

      <p className="text-[11px] text-stone-400 mt-6 text-center">
        No password needed — we&apos;ll email you a one-tap sign-in link.
      </p>
      <p className="text-[11px] text-stone-400 mt-2 text-center">
        By continuing, you agree to our{' '}
        <Link href="/terms" className="text-amber-700 underline">Terms</Link> &amp;{' '}
        <Link href="/privacy" className="text-amber-700 underline">Privacy Policy</Link>.
      </p>
    </div>
  )
}
