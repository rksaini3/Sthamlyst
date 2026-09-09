import type { Metadata, Viewport } from 'next'
import * as React from 'react'
import { Fraunces, Inter, Noto_Sans_Devanagari, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import DynamicFab from '@/components/DynamicFab'
import GlobalHeader from '@/components/GlobalHeader'
import ConnectivityToast from '@/components/ConnectivityToast'
import AnalyticsConsent from '@/components/AnalyticsConsent'
import { AuthProvider } from '@/lib/AuthProvider'
import { ThemeProvider } from '@/lib/ThemeProvider'
import { PushInit } from '@/components/PushInit'
import LocationGate from '@/components/LocationGate'

// Fonts configuration
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', weight: ['500', '600', '700'] })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const notoDevanagari = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-noto-devanagari' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-plex-mono', weight: ['400', '500'] })

// PWA Metadata
export const metadata: Metadata = {
  title: 'Sthamly — Boliye, Bhaav Kariye, Sauda Pakka!',
  description: 'Voice-first hyperlocal marketplace — apne mohalle ke dukaandaron se bolkar bhaav kariye, live boli lagaiye.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sthamly',
  },
}

// Viewport configuration
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#B5451B',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${notoDevanagari.variable} ${plexMono.variable}`}>
      {/* 
        body: मोबाइल पर नॉर्मल रहेगा। लैपटॉप/कंप्यूटर (md:) होने पर ही फ्लेक्सबॉक्स एक्टिव होगा 
        ताकि पूरा ऐप स्क्रीन के सेंटर में रहे और बैकग्राउंड कलर बदले।
      */}
      <body className="min-h-dvh bg-white dark:bg-stone-950 dark:text-stone-100 font-body md:bg-stone-100 md:dark:bg-stone-900 md:flex md:justify-center md:items-start">
        <ThemeProvider>
          <AuthProvider>
            <LocationGate>
              
              {/* 
                App Wrapper: मोबाइल पर w-full (100% फुल स्क्रीन चौड़ाई) रहेगा। 
                केवल टैबलेट या कंप्यूटर स्क्रीन पर (md:) यह 'max-w-md' (448px) चौड़ाई का मोबाइल फ्रेम बनेगा, 
                जिससे बड़ी स्क्रीन पर भी ऐप ब्लैंक या क्रैश नहीं होगा।
              */}
              <div className="w-full min-h-dvh bg-white dark:bg-stone-950 relative flex flex-col justify-between md:max-w-md md:mx-auto md:shadow-2xl">
                
                {/* ग्लोबल हेडर और कनेक्टिविटी अलर्ट्स */}
                <GlobalHeader />
                <ConnectivityToast />
                
                {/* मुख्य कंटेंट एरिया जो बची हुई जगह घेरेगा */}
                <main className="flex-1 w-full overflow-y-auto no-scrollbar">
                  {children}
                </main>
                
                {/* फ्लोटिंग बटन्स, बॉटम नेविगेशन और PWA पुश इनिशियलाइज़र */}
                <DynamicFab />
                <BottomNav />
                <AnalyticsConsent />
                <PushInit />
                
              </div>

            </LocationGate>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
