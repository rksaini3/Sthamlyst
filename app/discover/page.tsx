'use client'

import { useRef, useState } from 'react'
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
  distance_km: number | null
}

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

  const [myLat, setMyLat] = useState<number | null>(null)
  const [myLng, setMyLng] = useState<number | null>(null)

  // Tracks which search request is the most recent one — if an older,
  // slower request resolves after a newer one, its result is thrown
  // away instead of overwriting the screen with stale data.
  const searchIdRef = useRef(0)

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
        setError('Location access denied ya nahi mil paayi — Discovery ke liye location zaroori hai.')
        setLoading(false)
      },
      {
        timeout: 10000, // 10 seconds — don't hang forever on weak GPS
        maximumAge: 60000, // reuse a location up to 1 min old, avoids a fresh fix every time
      }
    )
  }

  // radiusOverride / categoryOverride let a caller pass the value it JUST
  // set via setState, instead of relying on `radius` / `category` from the
  // closure — setState is async, so reading the state variable right after
  // calling setRadius/setCategory would still see the OLD value.
  async function runSearch(
    lat?: number,
    lng?: number,
    radiusOverride?: number,
    categoryOverride?: string
  ) {
    setError('')

    const searchLat = lat ?? myLat
    const searchLng = lng ?? myLng
    const searchRadius = radiusOverride ?? radius
    const searchCategory = categoryOverride !== undefined ? categoryOverride : category

    if (searchLat == null || searchLng == null) {
      setError('Pehle apni location share karo.')
      return
    }

    const thisSearchId = ++searchIdRef.current
    setLoading(true)

    const { data, error: rpcError } = await supabase.rpc('discover_nearby', {
      p_lat: searchLat,
      p_lng: searchLng,
      p_radius_km: searchRadius,
      p_category: searchCategory || null,
    })

    // A newer search started while this one was in flight — ignore
    // this now-stale result entirely (don't touch results/loading).
    if (thisSearchId !== searchIdRef.current) return

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
    runSearch(undefined, undefined, r)
  }

  function handleCategoryChange(c: string) {
    setCategory(c)
    runSearch(undefined, undefined, undefined, c)
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
                {r.city} · {r.distance_km != null ? `${r.distance_km.toFixed(1)} km away` : 'distance unknown'}
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
