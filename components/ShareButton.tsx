'use client'

import { Share2 } from 'lucide-react'

export default function ShareButton({
  url, title, text, className = 'text-stone-500',
}: { url: string; title: string; text?: string; className?: string }) {
  async function handleShare() {
    const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: fullUrl })
      } catch {
        // user cancelled — no-op
      }
    } else {
      await navigator.clipboard.writeText(fullUrl)
      alert('Link copied!')
    }
  }

  return (
    <button onClick={handleShare} className={className} aria-label="Share">
      <Share2 size={18} />
    </button>
  )
}
