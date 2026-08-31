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

// Locks the viewport to a fixed, predictable scale on every load —
// including the fresh full-page reload that happens right after coming
// back from Google Sign-In — so the page never renders zoomed in/out
// unexpectedly.
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
            {/* Google Analytics only loads after the user accepts the
                consent banner rendered inside this component. */}
            <AnalyticsConsent />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
