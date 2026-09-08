'use client'

import { useEffect } from 'react'

export default function SwUpdateWatcher() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let reloaded = false

    function forceReload() {
      if (reloaded) return
      reloaded = true
      window.location.reload()
    }

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration) return

      // Agar koi naya service-worker "waiting" state mein hai (already
      // install ho chuka hai lekin purana wala abhi bhi control kar raha
      // hai), use turant activate karne ko bolo.
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }

      // Jab naya service-worker control lene lage, page ko ek baar reload
      // kar do taaki naya JS/CSS turant load ho, purana cached shell nahi.
      navigator.serviceWorker.addEventListener('controllerchange', forceReload)

      // Har load pe update check bhi kara do, taaki agla deploy bhi jaldi pakde.
      registration.update().catch(() => {})
    })

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', forceReload)
    }
  }, [])

  return null
}
