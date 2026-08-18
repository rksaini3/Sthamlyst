'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

type Product = {
  id: string
  title: string
  description: string | null
  maker_name: string
  maker_verified?: boolean
  maker_city: string
  price: number
  image_url: string | null
  category: string
  max_discount_points: number
  points_to_rupee_ratio: number
}

export default function BazaarPage() {
  const { user, loading: authLoading } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [pointsBalance, setPointsBalance] = useState<number | null>(null)
  const [totalSaved, setTotalSaved] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  async function refreshProfile() {
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('sthamly_points, total_saved_rupees')
      .eq('id', user.id)
      .single()
    if (profile) {
      setPointsBalance(profile.sthamly_points)
      setTotalSaved(profile.total_saved_rupees)
    }
  }

  useEffect(() => {
    if (authLoading) return
    async function load() {
      const { data: productData } = await supabase
        .from('products')
        .select('*, profiles:maker_id ( seller_verified )')
        .eq('is_active', true)

      if (productData) {
        const mapped = productData.map((p: any) => ({
          ...p,
          maker_verified: p.profiles?.seller_verified ?? false,
        }))
        setProducts(mapped as Product[])
      }

      await refreshProfile()
      setLoading(false)
    }
    load()
  }, [authLoading, user])

  if (loading) {
    return <div className="p-6 text-center text-stone-500">Loading local bazaar…</div>
  }

  return (
    <div className="max-w-md mx-auto pb-24">
      <header className="sticky top-0 bg-amber-50/95 backdrop-blur px-4 py-4 border-b border-amber-100 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-amber-900">Local Bazaar</h1>
            <p className="text-xs text-amber-700 mt-0.5">Handmade goods, direct from Gonda makers</p>
          </div>
          {pointsBalance !== null && (
            <span className="text-xs font-bold bg-amber-600 text-white px-3 py-1.5 rounded-full whitespace-nowrap">
              🪙 {pointsBalance} pts
            </span>
          )}
        </div>

        {totalSaved !== null && totalSaved > 0 && (
          <div className="mt-3 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-xl px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-medium">आपने अब तक बचाए</span>
            <span className="text-lg font-extrabold">₹{totalSaved.toFixed(0)}</span>
          </div>
        )}
      </header>

      <div className="px-4 pt-4 grid grid-cols-1 gap-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            pointsBalance={pointsBalance}
            onRedeemed={refreshProfile}
          />
        ))}
        {products.length === 0 && (
          <p className="text-center text-stone-400 pt-10">No products listed yet.</p>
        )}
      </div>
    </div>
  )
}

function ProductCard({
  product,
  pointsBalance,
  onRedeemed,
}: {
  product: Product
  pointsBalance: number | null
  onRedeemed: () => void
}) {
  const [pointsToUse, setPointsToUse] = useState(0)
  const [confirmedDiscount, setConfirmedDiscount] = useState(0)
  const [redeeming, setRedeeming] = useState(false)
  const [redeemed, setRedeemed] = useState(false)
  const { user } = useAuth()
  const router = useRouter()

  const cap = Math.min(product.max_discount_points, pointsBalance ?? 0)

  // Pure client-side preview — no points are deducted until "Confirm" is tapped
  const previewDiscount = pointsToUse * product.points_to_rupee_ratio
  const activeDiscount = redeemed ? confirmedDiscount : previewDiscount
  const finalPrice = Math.max(product.price - activeDiscount, 0)

  async function confirmRedeem() {
    if (!user) { router.push('/login'); return }
    if (pointsToUse === 0) return
    setRedeeming(true)
    const { data, error } = await supabase.rpc('redeem_points', {
      p_product_id: product.id,
      p_points_to_use: pointsToUse,
    })
    setRedeeming(false)
    if (!error && typeof data === 'number') {
      setConfirmedDiscount(data)
      setRedeemed(true)
      onRedeemed()
    }
  }

  async function chatToBargain() {
    if (!user) { router.push('/login'); return }
    const { data, error } = await supabase.rpc('start_conversation', {
      p_product_id: product.id,
    })
    if (!error && data) router.push(`/chat/${data}`)
  }

  return (
    <div className="bg-white rounded-2xl border border-amber-100 overflow-hidden shadow-sm">
      <div className="w-full h-[280px] bg-stone-200">
        {product.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.title} className="w-full h-full object-cover" />
        )}
      </div>

      <div className="p-4">
        <p className="text-[11px] text-stone-500">
          by <span className="font-semibold text-stone-700">{product.maker_name}</span> · {product.maker_city}
          {product.maker_verified && (
            <span className="ml-1.5 text-green-600 font-semibold">✓ Verified</span>
          )}
        </p>
        <h2 className="font-bold text-stone-900 mt-1">{product.title}</h2>
        <p className="text-sm text-stone-500 mt-1">{product.description}</p>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-extrabold text-stone-900">₹{finalPrice.toFixed(0)}</span>
          {activeDiscount > 0 && (
            <span className="text-sm line-through text-stone-400">₹{product.price.toFixed(0)}</span>
          )}
        </div>

        {cap > 0 && !redeemed && (
          <div className="mt-3">
            <p className="text-[11px] text-stone-500 mb-1">
              Use your points for a discount (up to {cap} pts)
            </p>
            <input
              type="range"
              min={0}
              max={cap}
              value={pointsToUse}
              onChange={(e) => setPointsToUse(Number(e.target.value))}
              className="w-full accent-amber-600"
            />
            <p className="text-xs text-amber-700 font-medium">
              {pointsToUse} pts → ₹{previewDiscount.toFixed(0)} off (preview)
            </p>
            {pointsToUse > 0 && (
              <button
                onClick={confirmRedeem}
                disabled={redeeming}
                className="mt-2 w-full bg-green-600 text-white font-semibold py-2 rounded-xl text-xs disabled:opacity-50"
              >
                {redeeming ? 'Redeeming…' : `Confirm & Redeem ${pointsToUse} pts`}
              </button>
            )}
          </div>
        )}

        {redeemed && (
          <p className="mt-3 text-xs font-semibold text-green-700 bg-green-50 rounded-xl px-3 py-2 text-center">
            ✓ ₹{confirmedDiscount.toFixed(0)} discount locked in — show this to the seller
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <button className="flex-1 bg-amber-600 text-white font-semibold py-2.5 rounded-xl text-sm">
            Add to Cart
          </button>
          <button
            onClick={chatToBargain}
            className="flex-1 border border-amber-600 text-amber-700 font-semibold py-2.5 rounded-xl text-sm"
          >
            💬 Chat to Bargain
          </button>
        </div>
      </div>
    </div>
  )
}
