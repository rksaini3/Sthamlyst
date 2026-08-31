'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'

const CONSENT_KEY = 'sthamly_analytics_consent'
const GA_ID = 'G-63TFFQXTB2'

type Consent = 'accepted' | 'declined' | null

export default function AnalyticsConsent() {
  const [consent, setConsent] = useState<Consent>(null)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(CONSENT_KEY) as Consent
    if (stored === 'accepted' || stored === 'declined') {
      setConsent(stored)
    } else {
      setShowBanner(true)
    }
  }, [])

  function accept() {
    window.localStorage.setItem(CONSENT_KEY, 'accepted')
    setConsent('accepted')
    setShowBanner(false)
  }

  function decline() {
    window.localStorage.setItem(CONSENT_KEY, 'declined')
    setConsent('declined')
    setShowBanner(false)
  }

  return (
    <>
      {consent === 'accepted' && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}
          </Script>
        </>
      )}

      {showBanner && (
        <div className="fixed bottom-20 left-3 right-3 z-40 max-w-md mx-auto bg-stone-900 text-white rounded-2xl px-4 py-3 shadow-lg">
          <p className="text-xs text-stone-200 mb-2.5">
            Hum sirf app improve karne ke liye anonymous usage analytics use karte hain. Koi
            personal data advertisers ko share nahi hota.
          </p>
          <div className="flex gap-2">
            <button
              onClick={accept}
              className="flex-1 bg-amber-600 text-white text-xs font-semibold py-2 rounded-full"
            >
              Accept
            </button>
            <button
              onClick={decline}
              className="flex-1 bg-white/10 text-white text-xs font-semibold py-2 rounded-full"
            >
              Decline
            </button>
          </div>
        </div>
      )}
    </>
  )
}
