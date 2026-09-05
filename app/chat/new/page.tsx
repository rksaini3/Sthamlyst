'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PageSkeleton from '@/components/PageSkeleton'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

export default function NewChatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const listingId = searchParams.get('listing')
  const { user, loading: authLoading } = useAuth()

  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) return // login-wall render honge neeche
    if (!listingId) {
      setError('Koi listing nahi mili — pehle kisi product pe "भाव करें" dabayein.')
      return
    }

    let cancelled = false

    async function resolveConversation() {
      // 1. Listing ka seller pata karo
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, maker_id')
        .eq('id', listingId)
        .single()

      if (cancelled) return
      if (productError || !product) {
        setError('Ye listing ab available nahi hai.')
        return
      }

      if (product.maker_id === user!.id) {
        setError('Aap apni khud ki listing pe bhaav nahi kar sakte.')
        return
      }

      // 2. Pehle se koi conversation hai to wahi use karo
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('buyer_id', user!.id)
        .eq('seller_id', product.maker_id)
        .eq('product_id', product.id)
        .maybeSingle()

      if (cancelled) return

      if (existing) {
        router.replace(`/chat/${existing.id}`)
        return
      }

      // 3. Naya conversation banao
      const { data: created, error: insertError } = await supabase
        .from('conversations')
        .insert({
          buyer_id: user!.id,
          seller_id: product.maker_id,
          product_id: product.id,
        })
        .select('id')
        .single()

      if (cancelled) return

      if (insertError || !created) {
        setError('Chat shuru nahi ho payi: ' + (insertError?.message || 'kuch galat ho gaya'))
        return
      }

      router.replace(`/chat/${created.id}`)
    }

    resolveConversation()
    return () => {
      cancelled = true
    }
  }, [authLoading, user?.id, listingId])

  if (authLoading) return <PageSkeleton rows={1} />

  if (!user) {
    return (
      <div className="max-w-md mx-auto min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-bold text-stone-900 dark:text-stone-100">Chat shuru karne ke liye sign in karein</p>
        <Link href="/login" className="mt-4 bg-clay text-white font-semibold py-3 px-6 rounded-xl text-sm">
          Sign In
        </Link>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <p className="text-3xl mb-3">⚠️</p>
        <p className="text-sm text-stone-600 dark:text-stone-300">{error}</p>
        <Link href="/" className="mt-4 text-sm font-semibold text-clay underline">
          Home pe wapas jaayein
        </Link>
      </div>
    )
  }

  return <PageSkeleton rows={1} />
}
