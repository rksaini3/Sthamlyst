'use client'

import { useState } from 'react'
import TopBar from '@/components/TopBar'
import StoriesBar from '@/components/StoriesBar'
import ReelFeed from '@/components/ReelFeed'

export default function Home() {
  const [activeTheme, setActiveTheme] = useState<string | null>(null)

  return (
    <div className="max-w-md mx-auto pb-24 min-h-screen">
      <TopBar />
      <StoriesBar activeTheme={activeTheme} onSelect={setActiveTheme} />
      <ReelFeed themeFilter={activeTheme} />
    </div>
  )
}
