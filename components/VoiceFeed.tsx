'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import VoicePlayerCard from '@/components/VoicePlayerCard'
import { useAuth } from '@/lib/AuthProvider'

const NEARBY_RADIUS_KM = 5

type Listing = {
  id: string
  title: string
  maker_name: string
  maker_city: string | null
  price: number
  image_url: string | null
  voice_note_url: string | null
  voice_duration_sec: number | null
  is_boosted: boolean
  latitude: number | null
  longitude: number | null
  category: string | null
}

// Haversine distance in km between two lat/lng points
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export default function VoiceFeed({ themeFilter }: { themeFilter: string | null }) {
  const { user } = useAuth()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    async function loadUserLocation() {
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('latitude, longitude')
        .eq('id', user.id)
        .single()
      if (data?.latitude && data?.longitude) {
        setUserCoords({ lat: data.latitude, lng: data.longitude })
      }
    }
    loadUserLocation()
  }, [user?.id])

  useEffect(() => {
    let cancelled = false

    async function loadListings() {
      setLoading(true)
      let query = supabase
        .from('products')
        .select(
          'id, title, maker_name, maker_city, price, image_url, voice_note_url, voice_duration_sec, is_boosted, latitude, longitude, category'
        )
        .eq('is_active', true)
        .eq('listing_type', 'fixed_price')
        .not('voice_note_url', 'is', null)
        .order('is_boosted', { ascending: false })
        .order('created_at', { ascending: false })

      if (themeFilter) {
        query = query.eq('category', themeFilter)
      }

      const { data, error } = await query
      if (cancelled) return
      if (error) {
        console.error('voice feed fetch failed:', error)
        setLoading(false)
        return
      }

      let results = data ?? []
      if (userCoords) {
        results = results.filter((item) => {
          if (item.latitude == null || item.longitude == null) return true
          return (
            distanceKm(userCoords.lat, userCoords.lng, item.latitude, item.longitude) <=
            NEARBY_RADIUS_KM
          )
        })
      }

      setListings(results)
      setLoading(false)
    }

    loadListings()
    return () => {
      cancelled = true
    }
  }, [themeFilter, userCoords])

  if (loading) {
    return <p className="text-center text-stone-400 text-sm mt-10">लोड हो रहा है…</p>
  }

  if (listings.length === 0) {
    return (
      <p className="text-center text-stone-400 text-sm mt-10 px-6">
        आपके मोहल्ले में अभी कोई नई आवाज़ अपडेट नहीं है।
      </p>
    )
  }

  return (
    <div className="px-4 pt-3 space-y-3">
      {listings.map((listing) => (
        <VoicePlayerCard key={listing.id} listing={listing} />
      ))}

      {/* Finite feed end — no infinite scroll, matches the "no addiction" design */}
      <p className="text-center text-stone-400 text-xs py-6">
        आपके मोहल्ले के आज के सारे अपडेट्स पूरे हुए! 🎙️
      </p>
    </div>
  )
}
