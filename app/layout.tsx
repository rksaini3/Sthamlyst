import type { Metadata } from 'next'
import './globals.css'
import BottomNav from '@/components/BottomNav'

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
      <body className="min-h-screen bg-white">
        {children}
        <BottomNav />
      </body>
    </html>
  )
}
