import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Fraunces, Inter, Noto_Sans_Devanagari, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import GlobalHeader from '@/components/GlobalHeader'
import ConnectivityToast from '@/components/ConnectivityToast'
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
      <head>
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
        {/*
          One-time cleanup for machines that already have an OLD service
          worker registered from before this PWA fix existed. An old SW
          can keep serving stale JS chunk references forever on its own,
          so on first load we force-unregister anything old and reload
          once. The sessionStorage flag stops this from looping.
        */}
        <Script id="sw-cleanup" strategy="beforeInteractive">
          {`
            if ('serviceWorker' in navigator && !sessionStorage.getItem('sw-cleaned')) {
              navigator.serviceWorker.getRegistrations().then(function(regs) {
                if (regs.length > 0) {
                  sessionStorage.setItem('sw-cleaned', '1');
                  Promise.all(regs.map(function(r) { return r.unregister(); })).then(function() {
                    window.location.reload();
                  });
                }
              });
            }
          `}
        </Script>
      </head>
      <body className="min-h-dvh bg-white dark:bg-stone-950 dark:text-stone-100 font-body">
        <ThemeProvider>
          <AuthProvider>
            <GlobalHeader />
            <ConnectivityToast />
            {children}
            <BottomNav />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
