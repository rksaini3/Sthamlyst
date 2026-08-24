'use client'

import { useEffect, useState } from 'react'

export default function ConnectivityToast() {
  const [status, setStatus] = useState<'online' | 'offline' | null>(null)

  useEffect(() => {
    function handleOnline() {
      setStatus('online')
      setTimeout(() => setStatus(null), 2500)
    }
    function handleOffline() {
      setStatus('offline')
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!status) return null

  return (
    <div
      className={`fixed top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full text-xs font-semibold shadow-lg ${
        status === 'online' ? 'bg-mehendi text-white' : 'bg-stone-800 text-white'
      }`}
    >
      {status === 'online' ? '✓ Back online' : '⚠️ No internet connection'}
    </div>
  )
}
