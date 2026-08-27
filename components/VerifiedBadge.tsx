'use client'

import { CheckCircle2 } from 'lucide-react'

export default function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <CheckCircle2
      size={size}
      className="text-mehendi fill-mehendi-light inline-block flex-shrink-0"
      aria-label="Verified"
    />
  )
}