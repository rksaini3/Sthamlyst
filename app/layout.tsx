import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Fraunces, Inter, Noto_Sans_Devanagari, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import GlobalHeader from '@/components/GlobalHeader'
import ConnectivityToast from '@/components/ConnectivityToast'
import AnalyticsConsent from '@/components/AnalyticsConsent'
import { AuthProvider } from '@/lib/AuthProvider'
import { ThemeProvider } from '@/lib/ThemeProvider'
import { PushInit } from '@/components/PushInit' // ← ADDED

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', weight: ['500', '600', '700'] })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const notoDevanagari = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-noto-devanagari' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-plex-mono', weight: ['400', '500'] })

export const metadata: Metadata = {
  title: 'Sthamly — Learn & Earn',
  description: 'Learn from local makers, earn Sthamly Points, shop the local handmade bazaar.',
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
  children: ReactNode
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${notoDevanagari.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh bg-white dark:bg-stone-950 dark:text-stone-100 font-body">
        <ThemeProvider>
          <AuthProvider>
            <GlobalHeader />
            <ConnectivityToast />
            {children}
            <BottomNav />
            <AnalyticsConsent />
            <PushInit /> {/* ← ADDED: registers push subscription once the user session is ready */}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
