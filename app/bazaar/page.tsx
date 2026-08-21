'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingBag } from 'lucide-react'
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
  is_service: boolean
  duration_minutes: number | null
}

type CartLine = { product_id: string; quantity: number; product?: Product }

export default function BazaarPage() {
  const { user, loading: authLoading } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [pointsBalance, setPointsBalance] = useState<number | null>(null)
  const [totalSaved, setTotalSaved] = useState<number | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'products' | 'services'>('products')
  const [showCart, setShowCart] = useState(false)

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

  async function refreshCart(productMap?: Record<string, Product>) {
    if (!user) return
    const { data } = await supabase.from('cart_items').select('product_id, quantity').eq('user_id', user.id)
    if (data) {
      const map = productMap || Object.fromEntries(products.map((p) => [p.id, p]))
      setCart(data.map((c) => ({ ...c, product: map[c.product_id] })))
    }
  }

  useEffect(() => {
    if (authLoading) return
    async function load() {
      const { data: productData } = await supabase
        .from('products')
        .select('*, profiles:maker_id ( seller_verified )')
        .eq('is_active', true)

      let mapped: Product[] = []
      if (productData) {
        mapped = productData.map((p: any) => ({
          ...p,
          maker_verified: p.profiles?.seller_verified ?? false,
        }))
        setProducts(mapped)
      }

      await refreshProfile()
      if (user) {
        const productMap = Object.fromEntries(mapped.map((p) => [p.id, p]))
        await refreshCart(productMap)
      }
      setLoading(false)
    }
    load()
  }, [authLoading, user])

  async function addToCart(productId: string) {
    if (!user) return
    await supabase.rpc('add_to_cart', { p_product_id: productId, p_quantity: 1 })
    await refreshCart()
  }

  async function setQuantity(productId: string, qty: number) {
    await supabase.rpc('set_cart_quantity', { p_product_id: productId, p_quantity: qty })
    await refreshCart()
  }

  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0)
  const cartTotal = cart.reduce((sum, c) => sum + (c.product?.price || 0) * c.quantity, 0)

  if (loading) {
    return <div className="p-6 text-center text-stone-500">Loading local bazaar…</div>
  }

  const filtered = products.filter((p) => (tab === 'services' ? p.is_service : !p.is_service))

  return (
    <div className="max-w-md mx-auto pb-24 relative">
      <header className="sticky top-0 bg-amber-50/95 backdrop-blur px-4 py-4 border-b border-amber-100 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-heading font-semibold text-clay">Local Bazaar</h1>
            <p className="text-xs text-clay/70 mt-0.5">Handmade goods & services, direct from Gonda makers</p>
          </div>
          <div className="flex items-center gap-2">
            {pointsBalance !== null && (
              <span className="text-xs font-bold bg-turmeric text-white px-3 py-1.5 rounded-full whitespace-nowrap">
                🪙 {pointsBalance}
              </span>
            )}
            <button onClick={() => setShowCart(true)} className="relative">
              <ShoppingBag size={24} className="text-indigobrand" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-clay text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {totalSaved !== null && totalSaved > 0 && (
          <div className="mt-3 bg-mehendi text-white rounded-xl px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-medium">आपने अब तक बचाए</span>
            <span className="text-lg font-extrabold">₹{totalSaved.toFixed(0)}</span>
          </div>
        )}

        <div className="mt-3 flex gap-2 bg-white rounded-xl p-1 border border-amber-100">
          <button
            onClick={() => setTab('products')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold ${
              tab === 'products' ? 'bg-clay text-white' : 'text-stone-500'
            }`}
          >
            🏺 Products
          </button>
          <button
            onClick={() => setTab('services')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold ${
              tab === 'services' ? 'bg-clay text-white' : 'text-stone-500'
            }`}
          >
            🛠️ Services
          </button>
        </div>
      </header>

      <div className="px-4 pt-4 grid grid-cols-1 gap-4">
        {filtered.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            pointsBalance={pointsBalance}
            onRedeemed={refreshProfile}
            onAddToCart={() => addToCart(product.id)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-stone-400 pt-10">
            {tab === 'services' ? 'No services listed yet.' : 'No products listed yet.'}
          </p>
        )}
      </div>

      {/* Floating bill bar */}
      {cartCount > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md bg-mehendi text-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-lg z-20"
        >
          <span className="text-sm font-semibold">🛍️ झोले में {cartCount} सामान हैं</span>
          <span className="text-sm font-bold">₹{cartTotal.toFixed(0)} → खरीदें ➡️</span>
        </button>
      )}

      {showCart && (
        <CartSheet
          cart={cart}
          total={cartTotal}
          onClose={() => setShowCart(false)}
          onSetQuantity={setQuantity}
        />
      )}
    </div>
  )
}

function CartSheet({
  cart, total, onClose, onSetQuantity,
}: { cart: CartLine[]; total: number; onClose: () => void; onSetQuantity: (id: string, qty: number) => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white px-4 py-3 border-b border-stone-100 flex items-center justify-between">
          <h2 className="font-bold text-stone-900">झोला (Your Cart)</h2>
          <button onClick={onClose} className="text-2xl leading-none text-stone-400">×</button>
        </div>
        <div className="p-4 space-y-3">
          {cart.length === 0 && <p className="text-center text-stone-400 text-sm py-6">Your cart is empty.</p>}
          {cart.map((c) => (
            <div key={c.product_id} className="flex items-center gap-3">
              {c.product?.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.product.image_url} alt="" className="w-14 h-14 rounded-lg object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-800 truncate">{c.product?.title}</p>
                <p className="text-xs text-clay font-bold">₹{c.product?.price}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSetQuantity(c.product_id, c.quantity - 1)}
                  className="w-7 h-7 rounded-full border border-stone-300 text-sm"
                >
                  −
                </button>
                <span className="text-sm w-4 text-center">{c.quantity}</span>
                <button
                  onClick={() => onSetQuantity(c.product_id, c.quantity + 1)}
                  className="w-7 h-7 rounded-full border border-stone-300 text-sm"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="p-4 border-t border-stone-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-stone-700">Total</span>
              <span className="text-lg font-bold text-mehendi">₹{total.toFixed(0)}</span>
            </div>
            <button className="w-full bg-clay text-white font-semibold py-3 rounded-xl text-sm">
              Checkout (coming soon)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ProductCard({
  product,
  pointsBalance,
  onRedeemed,
  onAddToCart,
}: {
  product: Product
  pointsBalance: number | null
  onRedeemed: () => void
  onAddToCart: () => void
}) {
  const [pointsToUse, setPointsToUse] = useState(0)
  const [confirmedDiscount, setConfirmedDiscount] = useState(0)
  const [redeeming, setRedeeming] = useState(false)
  const [redeemed, setRedeemed] = useState(false)
  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState(false)
  const [added, setAdded] = useState(false)
  const { user } = useAuth()
  const router = useRouter()

  const cap = Math.min(product.max_discount_points, pointsBalance ?? 0)

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

  async function requestBooking() {
    if (!user) { router.push('/login'); return }
    setBooking(true)
    const { error } = await supabase.rpc('request_booking', {
      p_service_id: product.id,
      p_requested_time: null,
      p_notes: null,
    })
    setBooking(false)
    if (!error) {
      setBooked(true)
      const { data } = await supabase.rpc('start_conversation', { p_product_id: product.id })
      if (data) router.push(`/chat/${data}`)
    }
  }

  function handleAddToCart() {
    if (!user) { router.push('/login'); return }
    onAddToCart()
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
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
            <span className="ml-1.5 text-mehendi font-semibold">✓ Verified</span>
          )}
        </p>
        <h2 className="font-bold text-stone-900 mt-1">{product.title}</h2>
        <p className="text-sm text-stone-500 mt-1">{product.description}</p>
        {product.is_service && product.duration_minutes && (
          <p className="text-[11px] text-stone-400 mt-1">⏱ {product.duration_minutes} min</p>
        )}

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-extrabold text-stone-900">₹{finalPrice.toFixed(0)}</span>
          {activeDiscount > 0 && (
            <span className="text-sm line-through text-stone-400">₹{product.price.toFixed(0)}</span>
          )}
        </div>

        {!product.is_service && cap > 0 && !redeemed && (
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
              className="w-full accent-clay"
            />
            <p className="text-xs text-turmeric font-medium">
              {pointsToUse} pts → ₹{previewDiscount.toFixed(0)} off (preview)
            </p>
            {pointsToUse > 0 && (
              <button
                onClick={confirmRedeem}
                disabled={redeeming}
                className="mt-2 w-full bg-mehendi text-white font-semibold py-2 rounded-xl text-xs disabled:opacity-50"
              >
                {redeeming ? 'Redeeming…' : `Confirm & Redeem ${pointsToUse} pts`}
              </button>
            )}
          </div>
        )}

        {redeemed && (
          <p className="mt-3 text-xs font-semibold text-mehendi bg-mehendi-light rounded-xl px-3 py-2 text-center">
            ✓ ₹{confirmedDiscount.toFixed(0)} discount locked in — show this to the seller
          </p>
        )}

        {booked && (
          <p className="mt-3 text-xs font-semibold text-mehendi bg-mehendi-light rounded-xl px-3 py-2 text-center">
            ✓ Booking requested — chat opened to confirm the time
          </p>
        )}

        <div className="mt-3 flex gap-2">
          {product.is_service ? (
            <button
              onClick={requestBooking}
              disabled={booking || booked}
              className="flex-1 bg-clay text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50"
            >
              {booking ? 'Requesting…' : booked ? 'Requested ✓' : '📅 Book Now'}
            </button>
          ) : (
            <button
              onClick={handleAddToCart}
              className="flex-1 bg-clay text-white font-semibold py-2.5 rounded-xl text-sm"
            >
              {added ? '✓ झोले में डाला' : 'झोले में डालें'}
            </button>
          )}
          <button
            onClick={chatToBargain}
            className="flex-1 border border-clay text-clay font-semibold py-2.5 rounded-xl text-sm"
          >
            💬 मोल-भाव करें
          </button>
        </div>
      </div>
    </div>
  )
}
