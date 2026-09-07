'use client'

import { useEffect, useState } from 'react'
import { MapPin, Loader2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

// Phase 1 target area — jaise business naye shehar mein jaaye, yahan add karte jao
const CITIES = ['Gonda', 'Lucknow', 'Ayodhya', 'Basti', 'Balrampur', 'Other']

type Step = 'checking' | 'gps-confirm' | 'manual' | 'saving'

type GpsResult = {
  city: string | null
  mohalla: string | null
  lat: number
  lng: number
}

export default function LocationOnboardingSheet({ onDone }: { onDone: () => void }) {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('checking')
  const [gpsResult, setGpsResult] = useState<GpsResult | null>(null)
  const [gpsWarning, setGpsWarning] = useState('')

  const [manualCity, setManualCity] = useState(CITIES[0])
  const [manualCityOther, setManualCityOther] = useState('')
  const [manualMohalla, setManualMohalla] = useState('')
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    tryGpsLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function tryGpsLocation() {
    setStep('checking')
    setGpsWarning('')

    if (!('geolocation' in navigator)) {
      setStep('manual')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        try {
          // Nominatim (OpenStreetMap) — free reverse-geocoding, koi API key nahi chahiye.
          // NOTE: Ye free service hai, isliye heavy/production-scale traffic ke liye
          // aage chalke ek paid geocoding API (Google/Mapbox) lena behtar rahega.
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=16&addressdetails=1`,
            { headers: { 'Accept-Language': 'hi,en' } }
          )
          if (!res.ok) throw new Error('reverse-geocode failed')
          const data = await res.json()
          const addr = data.address || {}
          const city: string | null = addr.city || addr.town || addr.county || null
          const mohalla: string | null = addr.suburb || addr.neighbourhood || addr.village || null

          setGpsResult({ city, mohalla, lat: latitude, lng: longitude })
          setStep('gps-confirm')
        } catch {
          setGpsResult({ city: null, mohalla: null, lat: latitude, lng: longitude })
          setStep('manual')
        }
      },
      () => {
        setGpsWarning('Location access nahi mila. Neeche se apna shehar chun lijiye.')
        setStep('manual')
      },
      { enableHighAccuracy: false, timeout: 8000 }
    )
  }

  async function confirmGpsLocation() {
    if (!gpsResult || !user) return
    setStep('saving')
    setSaveError('')

    const { error } = await supabase
      .from('profiles')
      .update({
        city: gpsResult.city,
        mohalla: gpsResult.mohalla,
        latitude: gpsResult.lat,
        longitude: gpsResult.lng,
      })
      .eq('id', user.id)

    if (error) {
      setSaveError('Save nahi ho paya: ' + error.message)
      setStep('gps-confirm')
      return
    }
    onDone()
  }

  async function saveManualLocation() {
    if (!user) return
    const finalCity = manualCity === 'Other' ? manualCityOther.trim() : manualCity
    if (!finalCity) {
      setSaveError('Shehar chunna zaroori hai.')
      return
    }
    if (!manualMohalla.trim()) {
      setSaveError('Mohalla/Area likhna zaroori hai.')
      return
    }

    setStep('saving')
    setSaveError('')

    const { error } = await supabase
      .from('profiles')
      .update({
        city: finalCity,
        mohalla: manualMohalla.trim(),
        latitude: gpsResult?.lat ?? null,
        longitude: gpsResult?.lng ?? null,
      })
      .eq('id', user.id)

    if (error) {
      setSaveError('Save nahi ho paya: ' + error.message)
      setStep('manual')
      return
    }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-stone-900 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-clay/10 flex items-center justify-center mb-4">
        <MapPin size={28} className="text-clay" />
      </div>

      {step === 'checking' && (
        <>
          <p className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-1">
            Aapki location dhoondh rahe hain…
          </p>
          <Loader2 size={22} className="animate-spin text-clay mt-4" />
        </>
      )}

      {step === 'gps-confirm' && gpsResult && (
        <>
          <p className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-2">
            Aapki location: {gpsResult.mohalla ? `${gpsResult.mohalla}, ` : ''}
            {gpsResult.city || 'Pata nahi chala'}
          </p>
          <p className="text-sm text-stone-500 mb-6">
            Isse hum aapko aas-paas ke saamaan dikhayenge — sahi hai?
          </p>
          {saveError && <p className="text-xs text-red-600 mb-3">{saveError}</p>}
          <button
            onClick={confirmGpsLocation}
            className="w-full max-w-xs bg-clay text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2"
          >
            <Check size={16} /> Haan, sahi hai
          </button>
          <button
            onClick={() => setStep('manual')}
            className="w-full max-w-xs text-stone-500 dark:text-stone-400 font-semibold py-3 text-sm mt-1"
          >
            Nahi, khud chunna hai
          </button>
        </>
      )}

      {step === 'manual' && (
        <>
          <p className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-1">
            Apna shehar aur mohalla chuniye
          </p>
          {gpsWarning && <p className="text-xs text-amber-600 mb-3">{gpsWarning}</p>}
          <p className="text-sm text-stone-500 mb-5">
            Isse hum aapko aas-paas ke saamaan dikhayenge
          </p>

          <div className="w-full max-w-xs text-left">
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Shehar
            </label>
            <select
              value={manualCity}
              onChange={(e) => setManualCity(e.target.value)}
              className="w-full border border-stone-300 dark:border-stone-700 dark:bg-stone-800 rounded-xl px-3 py-2.5 text-sm mb-3"
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {manualCity === 'Other' && (
              <input
                value={manualCityOther}
                onChange={(e) => setManualCityOther(e.target.value)}
                placeholder="Apne shehar ka naam likhein"
                className="w-full border border-stone-300 dark:border-stone-700 dark:bg-stone-800 rounded-xl px-3 py-2.5 text-sm mb-3"
              />
            )}

            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Mohalla / Area
            </label>
            <input
              value={manualMohalla}
              onChange={(e) => setManualMohalla(e.target.value)}
              placeholder="Jaise: Datt, Rajpura"
              className="w-full border border-stone-300 dark:border-stone-700 dark:bg-stone-800 rounded-xl px-3 py-2.5 text-sm"
            />
          </div>

          {saveError && <p className="text-xs text-red-600 mt-3">{saveError}</p>}

          <button
            onClick={saveManualLocation}
            className="w-full max-w-xs bg-clay text-white font-semibold py-3 rounded-xl text-sm mt-5"
          >
            Save Karein
          </button>
        </>
      )}

      {step === 'saving' && (
        <>
          <p className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-4">Save ho raha hai…</p>
          <Loader2 size={22} className="animate-spin text-clay" />
        </>
      )}
    </div>
  )
}
