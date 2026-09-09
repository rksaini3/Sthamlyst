'use client'

import { useEffect } from 'react'

const RELOAD_FLAG = 'sthamly-sw-reloaded'

export default function SwUpdateWatcher() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (sessionStorage.getItem(RELOAD_FLAG)) return

    let didReload = false
    function reloadOnce() {
      if (didReload) return
      didReload = true
      sessionStorage.setItem(RELOAD_FLAG, '1')
      window.location.reload()
    }

    function activateWorker(worker: ServiceWorker) {
      navigator.serviceWorker.addEventListener('controllerchange', reloadOnce, { once: true })
      worker.postMessage({ type: 'SKIP_WAITING' })
    }

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration) return

      if (registration.waiting) {
        activateWorker(registration.waiting)
        return
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            activateWorker(newWorker)
          }
        })
      })
    })
  }, [])

  return null
}