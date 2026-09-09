import type { Metadata, Viewport } from 'next'
import * as React from 'react' // ← यहाँ बदलाव किया है ताकि React.ReactNode मिल सके
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

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', weight: ['500', '600', '700'] })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const notoDevanagari = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-noto-devanagari' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-plex-mono', weight: ['400', '500'] })

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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#B5451B',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode // ← यहाँ React.ReactNode कर दिया है ताकि TypeScript एरर न दे
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${notoDevanagari.variable} ${plexMono.variable}`}>
      {/* md:flex से लैपटॉप स्क्रीन पर आपका ऐप बीच में रहेगा और बैकग्राउंड सुंदर दिखेगा */}
      <body className="min-h-dvh bg-white dark:bg-stone-950 dark:text-stone-100 font-body md:bg-stone-100 md:dark:bg-stone-900 md:flex md:justify-center md:items-start">
        <ThemeProvider>
          <AuthProvider>
            <LocationGate>
              
              {/* सुरक्षित मोबाइल फ्रेम: यह बड़ी स्क्रीन पर लेआउट को ब्लैंक (Crash) होने से बचाएगा */}
              <div className="w-full max-w-md mx-auto min-h-dvh bg-white dark:bg-stone-950 shadow-2xl relative flex flex-col justify-between">
                
                <GlobalHeader />
                <ConnectivityToast />
                
                {/* आपका मुख्य कंटेंट पेज */}
                <main className="flex-1 w-full overflow-y-auto no-scrollbar">
                  {children}
                </main>
                
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
