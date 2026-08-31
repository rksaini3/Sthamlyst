'use client'

import { useState } from 'react'
import { MapPin, BadgeCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

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

// Rounding to 2 decimal places gives ~1.1km of "fuzz" on latitude and
// a similar order on longitude — this is what actually makes the
// location "approximate" rather than exact GPS. We round ONCE, right
// where the raw coordinate first enters the app, and use that same
// rounded value everywhere downstream (storage AND search) — so
// there's never a second, more-precise copy of the user's real
// position sitting in the browser or sent to the server.
function fuzzCoordinate(value: number): number {
  return Math.round(value * 100) / 100
}

export default function DiscoverPage() {
  const { user } = useAuth()
  const [radius, setRadius] = useState(5)
  const [category, setCategory] = useState('')
  const [results, setResults] = useState<NearbyResult[]>([])
  const [loading, setLoading] = useState(false)
  const [locationSet, setLocationSet] = useState(false)
  const [error, setError] = useState('')

  // Cached after the first successful geolocation fetch, so changing
  // the radius or category filter re-runs the search instantly using
  // this — instead of re-fetching the profile row from the database
  // every single time just to read back a value we already have.
  const [myLat, setMyLat] = useState<number | null>(null)
  const [myLng, setMyLng] = useState<number | null>(null)

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
        const lat = fuzzCoordinate(pos.coords.latitude)
        const lng = fuzzCoordinate(pos.coords.longitude)

        const { error: updateError } = await supabase.rpc('update_my_location', { p_lat: lat, p_lng: lng })
        if (updateError) {
          setError('Location save nahi ho payi: ' + updateError.message)
          setLoading(false)
          return
        }

        setMyLat(lat)
        setMyLng(lng)
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

    const searchLat = lat ?? myLat
    const searchLng = lng ?? myLng

    if (searchLat == null || searchLng == null) {
      setError('Pehle apni location share karo.')
      return
    }

    setLoading(true)
    const { data, error: rpcError } = await supabase.rpc('discover_nearby', {
      p_lat: searchLat,
      p_lng: searchLng,
      p_radius_km: radius,
      p_category: category || null,
    })

    if (rpcError) {
      setError('Search nahi ho paya: ' + rpcError.message)
      setResults([])
    } else {
      setResults((data as NearbyResult[]) || [])
    }
    setLoading(false)
  }

  function handleRadiusChange(r: number) {
    setRadius(r)
    runSearch()
  }

  function handleCategoryChange(c: string) {
    setCategory(c)
    runSearch()
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
                onClick={() => handleRadiusChange(r)}
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
            onChange={(e) => handleCategoryChange(e.target.value)}
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
            <div className="w-10 h-10 rounded-full bg-indigobrand-light flex items-center justify-center text-sm font-bold text-indigobrand">
              {r.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-800 flex items-center gap-1">
                {r.full_name || 'Sthamly User'}
                {r.seller_verified && <BadgeCheck size={14} className="text-mehendi fill-mehendi/20 flex-shrink-0" />}
              </p>
              <p className="text-[11px] text-stone-500">
                {r.city} · {r.distance_km} km away
                {r.business_category && ` · ${r.business_category}`}
              </p>
            </div>
          </div>
        ))}
        {locationSet && !loading && !error && results.length === 0 && (
          <p className="text-center text-stone-400 text-sm pt-6">
            {radius}km ke andar koi nahi mila. Radius badha ke try karo.
          </p>
        )}
      </div>
    </div>
  )
}