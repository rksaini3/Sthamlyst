'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import jsQR from 'jsqr'

// Set this to your real production domain(s).
const ALLOWED_HOSTS = ['sthamly.com', 'www.sthamly.com']

export default function QRScannerSheet({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState('')
  const router = useRouter()
  const scanningRef = useRef(true)

  useEffect(() => {
    // Fix 1: initialize to null so it's never "used before assigned"
    // under TypeScript strict mode.
    let stream: MediaStream | null = null

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          tick()
        }
      } catch {
        setError('Camera access nahi mil paaya. Permission check karo.')
      }
    }

    function tick() {
      if (!scanningRef.current) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        // Fix 3: willReadFrequently avoids the Chrome perf warning and
        // speeds up repeated getImageData calls in this scan loop.
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height)
          if (code?.data) {
            scanningRef.current = false
            handleResult(code.data)
            return
          }
        }
      }
      requestAnimationFrame(tick)
    }

    function handleResult(url: string) {
      try {
        const u = new URL(url)
        // Fix 2: verify the hostname too, not just the path — otherwise
        // any site with a /creator/xyz path gets treated as valid.
        if (!ALLOWED_HOSTS.includes(u.hostname)) {
          throw new Error('wrong domain')
        }
        const parts = u.pathname.split('/').filter(Boolean)
        const idx = parts.indexOf('creator')
        if (idx !== -1 && parts[idx + 1]) {
          stream?.getTracks().forEach((t) => t.stop())
          router.push(`/creator/${parts[idx + 1]}`)
          onClose()
          return
        }
      } catch {
        // not a valid Sthamly URL
      }
      setError('Yeh Sthamly QR code nahi lagta. Dobara try karo.')
      scanningRef.current = true
      requestAnimationFrame(tick)
    }

    start()
    return () => {
      scanningRef.current = false
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 pt-4">
        <button onClick={onClose} className="text-white"><X size={24} /></button>
        <span className="text-white font-semibold text-sm">Scan QR Code</span>
        <div className="w-6" />
      </div>

      <div className="flex-1 relative flex items-center justify-center">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
        <div className="relative w-64 h-64 border-4 border-white/80 rounded-2xl" />
      </div>

      {error && <p className="text-center text-red-400 text-xs pb-6 px-6">{error}</p>}
      <p className="text-center text-white/70 text-xs pb-8">Kisi Sthamly profile ka QR code frame ke andar rakho</p>
    </div>
  )
}
