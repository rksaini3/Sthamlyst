'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'
import LocationOnboardingSheet from '@/components/LocationOnboardingSheet'

export default function LocationGate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [needsLocation, setNeedsLocation] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (authLoading || !user) { setChecked(true); return }

    supabase
      .from('profiles')
      .select('city')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setNeedsLocation(!data?.city)
        setChecked(true)
      })
  }, [authLoading, user])

  if (!checked) return <>{children}</>

  return (
    <>
      {children}
      {needsLocation && <LocationOnboardingSheet onDone={() => setNeedsLocation(false)} />}
    </>
  )
}
