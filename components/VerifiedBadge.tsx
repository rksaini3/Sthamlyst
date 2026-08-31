'use client'

import { BadgeCheck } from 'lucide-react'

export default function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <BadgeCheck
      size={size}
      className="text-sky-400 fill-sky-400/20 inline-block flex-shrink-0"
      aria-label="Verified"
    />
  )
}
