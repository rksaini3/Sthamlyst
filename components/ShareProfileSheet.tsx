'use client'

import { useState, useRef } from 'react'
import type { ReactNode } from 'react'
import { X, Share2, Link as LinkIcon, Download } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'

export default function ShareProfileSheet({
  handle,
  onClose,
}: {
  handle: string
  onClose: () => void
}) {
  const [mode, setMode] = useState<'color' | 'dark' | 'light'>('color')
  const qrRef = useRef<HTMLDivElement>(null)
  const profileUrl = `https://sthamly.com/creator/${handle}`

  const bg =
    mode === 'color'
      ? 'bg-gradient-to-b from-amber-400 via-orange-500 to-clay'
      : mode === 'dark'
      ? 'bg-stone-950'
      : 'bg-white'
  const textColor = mode === 'light' ? 'text-stone-900' : 'text-white'

  async function handleShare() {
    if (navigator.share) {
      // Fix: navigator.share() rejects with an AbortError when the user
      // simply cancels the native share sheet — that's not a real error,
      // so swallow it instead of letting it surface as an unhandled
      // promise rejection.
      await navigator.share({ title: `@${handle} on Sthamly`, url: profileUrl }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(profileUrl)
      alert('Link copy ho gaya!')
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(profileUrl)
    alert('Link copy ho gaya!')
  }

  function handleDownload() {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${handle}-sthamly-qr.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${bg}`}>
      <div className="flex items-center justify-between px-4 pt-4">
        <button onClick={onClose} className={textColor} aria-label="Close">
          <X size={24} />
        </button>
        <div className="flex bg-black/20 rounded-full p-1">
          {(['color', 'light', 'dark'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-label={`${m} background`}
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                mode === m ? 'bg-white text-stone-900' : 'text-white/70'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="w-6" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div ref={qrRef} className="bg-white rounded-3xl p-6 flex flex-col items-center gap-4 shadow-xl">
          <QRCodeCanvas
            value={profileUrl}
            size={260}
            level="H"
          />
          <p className="text-clay font-black text-lg tracking-wide">@{handle.toUpperCase()}</p>
        </div>
      </div>

      <div className="bg-white rounded-t-3xl px-6 pt-6 pb-8 flex items-center justify-around">
        <ShareAction icon={<Share2 size={22} />} label="Share profile" onClick={handleShare} />
        <ShareAction icon={<LinkIcon size={22} />} label="Copy link" onClick={handleCopy} />
        <ShareAction icon={<Download size={22} />} label="Download" onClick={handleDownload} />
      </div>
    </div>
  )
}

function ShareAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 text-stone-700">
      <div className="w-14 h-14 rounded-full border border-stone-200 flex items-center justify-center">{icon}</div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}
