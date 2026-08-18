import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import { AuthProvider } from '@/lib/AuthProvider'

export const metadata: Metadata = {
  title: 'Sthamly — Learn & Earn',
  description: 'Learn from local makers, earn Sthamly Points, shop the local handmade bazaar.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
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
      <body className="min-h-screen bg-white">
        <AuthProvider>
          {children}
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  )
}
