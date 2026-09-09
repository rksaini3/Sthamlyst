'use client'

import { useEffect } from 'react'

const RELOAD_FLAG = 'sthamly-sw-reloaded'

export default function SwUpdateWatcher() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Agar is tab-session mein pehle hi ek baar reload kar chuke hain,
    // to dobara kabhi mat karo — yehi cheez infinite-loop ko rokti hai.
    if (sessionStorage.getItem(RELOAD_FLAG)) return

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration) return

      // Sirf tabhi kuch karo jab GENUINELY ek naya service-worker
      // "waiting" state mein ho (matlab real update available hai).
      // Warna kabhi bhi controllerchange listener mat lagao — usi se
      // loop banta hai.
      if (!registration.waiting) return

      function onControllerChange() {
        if (sessionStorage.getItem(RELOAD_FLAG)) return
        sessionStorage.setItem(RELOAD_FLAG, '1')
        window.location.reload()
      }

      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange, { once: true })
    })
  }, [])

  return null
}
