'use client'

import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'
import { VerifiedBadge } from '@/components/VerifiedBadge'

type NearbyResult = {
  id: string
  full_name: string | null
  city: string | null
  business_category: string | null
  is_seller: boolean
  is_creator: boolean
  seller_verified: boolean
  distance_km: number
}

// Rounding to 2 decimal places ≈ 1.1km of fuzz at the equator.
// This must match whatever the Privacy Policy promises ("approximate location").
// Do this BEFORE anything ever leaves the client — never send pos.coords raw.
function fuzzCoord(value: number, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export default function DiscoverPage() {
  const { user } = useAuth()
  const [radius, setRadius] = useState(5)
  const [category, setCategory] = useState('')
  const [results, setResults] = useState<NearbyResult[]>([])
  const [loading, setLoading] = useState(false)
  const [locationSet, setLocationSet] = useState(false)
  const [error, setError] = useState('')

  // Cache the approximate coords we already have so we don't re-hit
  // auth + profiles on every filter change.
  const [savedLat, setSavedLat] = useState<number | null>(null)
  const [savedLng, setSavedLng] = useState<number | null>(null)

  async function shareLocationAndSearch() {
    setError('')
    if (!user) {
      setError('Pehle sign in karo.')
      return
    }
    if (!navigator.geolocation) {
      setError('Ye browser location support nahi karta.')
      return
    }

    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Fuzz immediately — exact GPS never gets held in state or sent anywhere.
        const lat = fuzzCoord(pos.coords.latitude)
        const lng = fuzzCoord(pos.coords.longitude)

        const { error: updateError } = await supabase.rpc('update_my_location', {
          p_lat: lat,
          p_lng: lng,
        })

        if (updateError) {
          setError('Location save nahi ho payi. Dobara try karo.')
          setLoading(false)
          return
        }

        setSavedLat(lat)
        setSavedLng(lng)
        setLocationSet(true)
        await runSearch(lat, lng)
      },
      () => {
        setError('Location access denied — Discovery ke liye location zaroori hai.')
        setLoading(false)
      }
    )
  }

  async function runSearch(lat?: number, lng?: number) {
    setError('')

    // Prefer whatever we already have in state — avoids an extra
    // auth + profiles round trip on every radius/category change.
    let useLat = lat ?? savedLat
    let useLng = lng ?? savedLng

    if (!useLat || !useLng) {
      const { data: userData, error: authError } = await supabase.auth.getUser()
      if (authError || !userData?.user) {
        setError('Session expire ho gaya, dobara sign in karo.')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('latitude, longitude')
        .eq('id', userData.user.id)
        .single()

      if (profileError || !profile?.latitude || !profile?.longitude) {
        setError('Pehle apni location share karo.')
        return
      }

      useLat = profile.latitude
      useLng = profile.longitude
      setSavedLat(useLat)
      setSavedLng(useLng)
    }

    setLoading(true)
    const { data, error: rpcError } = await supabase.rpc('discover_nearby', {
      p_lat: useLat,
      p_lng: useLng,
      p_radius_km: radius,
      p_category: category || null,
    })

    if (rpcError) {
      setError('Nearby log load nahi ho paaye. Dobara try karo.')
      setResults([])
    } else if (data) {
      setResults(data as NearbyResult[])
    }
    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto pb-24 px-4 pt-6 min-h-dvh">
      <h1 className="text-xl font-heading font-semibold text-clay">Near You</h1>
      <p className="text-xs text-stone-500 mt-1">
        Approximate-location based — kabhi exact GPS nahi dikhaya jata.
      </p>

      {!locationSet ? (
        <button
          onClick={shareLocationAndSearch}
          disabled={loading}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-clay text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50"
        >
          <MapPin size={18} /> {loading ? 'Locating…' : 'Share Location to Discover'}
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            {[5, 10, 20].map((r) => (
              <button
                key={r}
                onClick={() => { setRadius(r); runSearch() }}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold ${
                  radius === r ? 'bg-clay text-white' : 'bg-stone-100 text-stone-600'
                }`}
              >
                {r} km
              </button>
            ))}
          </div>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); runSearch() }}
            className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            <option>Clay Crafts & Home Decor</option>
            <option>Photography</option>
            <option>Mehndi</option>
            <option>Tutoring</option>
            <option>Events</option>
          </select>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <div className="mt-4 space-y-2">
        {results.map((r) => (
          <div key={r.id} className="flex items-center gap-3 bg-white border border-stone-200 rounded-xl p-3">
            <div className="w-10 h-10 rounded-full bg-clay/10 flex items-center justify-center text-sm font-bold text-clay">
              {r.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-800 flex items-center gap-1">
                {r.full_name || 'Sthamly User'}
                {r.seller_verified && <VerifiedBadge />}
              </p>
              <p className="text-[11px] text-stone-500">
                {r.city} · {r.distance_km} km away
                {r.business_category && ` · ${r.business_category}`}
              </p>
            </div>
          </div>
        ))}
        {locationSet && !loading && results.length === 0 && (
          <p className="text-center text-stone-400 text-sm pt-6">
            {radius}km ke andar koi nahi mila. Radius badha ke try karo.
          </p>
        )}
      </div>
    </div>
  )
}
