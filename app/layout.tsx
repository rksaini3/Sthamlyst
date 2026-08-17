import type { Metadata } from 'next'
import './globals.css'

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
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
