'use client'

import { useEffect } from 'react'

const RELOAD_FLAG = 'sthamly-sw-reloaded'

export default function SwUpdateWatcher() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Agar is tab-session mein pehle hi ek baar reload kar chuke hain,
    // to dobara kabhi mat karo — yehi cheez infinite-loop ko rokti hai.
    if (sessionStorage.getItem(RELOAD_FLAG)) return

    function onControllerChange() {
      if (sessionStorage.getItem(RELOAD_FLAG)) return
      sessionStorage.setItem(RELOAD_FLAG, '1')
      window.location.reload()
    }

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration) return

      // Case 1: naya worker already "waiting" state mein mil gaya
      // (matlab update page load hone se PEHLE hi detect ho chuka tha)
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }

      // Case 2: naya worker BAAD mein aata hai — jab tab already khula
      // hai aur background mein naya deploy detect hota hai. Pehle wala
      // code isko miss kar raha tha, isliye reload kabhi trigger nahi
      // hota tha.
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      })

      // Ek hi jagah se controllerchange sunna hai (loop-guard ke saath),
      // chahe update Case 1 se aaye ya Case 2 se
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange, { once: true })
    })
  }, [])

  return null
}
