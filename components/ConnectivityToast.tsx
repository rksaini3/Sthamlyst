'use client'

import { useEffect, useState } from 'react'

export default function ConnectivityToast() {
  const [status, setStatus] = useState<'online' | 'offline' | null>(null)

  useEffect(() => {
    // Catch the case where the page loads while already offline — no
    // 'online'/'offline' event fires for that, since nothing changed
    // after mount, so it has to be checked explicitly.
    if (!navigator.onLine) setStatus('offline')

    let hideTimeout: ReturnType<typeof setTimeout> | undefined

    function handleOnline() {
      setStatus('online')
      hideTimeout = setTimeout(() => setStatus(null), 2500)
    }
    function handleOffline() {
      if (hideTimeout) clearTimeout(hideTimeout)
      setStatus('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (hideTimeout) clearTimeout(hideTimeout)
    }
  }, [])

  if (!status) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full text-xs font-semibold shadow-lg ${
        status === 'online' ? 'bg-mehendi text-white' : 'bg-stone-800 text-white'
      }`}
    >
      {status === 'online' ? '✓ Back online' : '⚠️ No internet connection'}
    </div>
  )
}
