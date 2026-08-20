import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Fraunces, Inter, Noto_Sans_Devanagari, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import GlobalHeader from '@/components/GlobalHeader'
import { AuthProvider } from '@/lib/AuthProvider'

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', weight: ['500', '600', '700'] })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const notoDevanagari = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-noto-devanagari' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-plex-mono', weight: ['400', '500'] })

export const metadata: Metadata = {
  title: 'Sthamly — Learn & Earn',
  description: 'Learn from local makers, earn Sthamly Coins, shop the local handmade bazaar.',
}

// Locks the viewport to a fixed, predictable scale on every load —
// including the fresh full-page reload that happens right after coming
// back from Google Sign-In — so the page never renders zoomed in/out
// unexpectedly.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${notoDevanagari.variable} ${plexMono.variable}`}>
      <head>
        {/* Google Analytics Tag */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-63TFFQXTB2"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-63TFFQXTB2');
          `}
        </Script>
      </head>
      <body className="min-h-dvh bg-white font-body">
        <AuthProvider>
          <GlobalHeader />
          {children}
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  )
}
