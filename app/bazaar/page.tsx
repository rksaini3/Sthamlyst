'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingBag } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'
import PageSkeleton from '@/components/PageSkeleton'
import ShareButton from '@/components/ShareButton'
import OptionsMenu from '@/components/OptionsMenu'
import VerifiedBadge from '@/components/VerifiedBadge'
import { startCheckout } from '@/lib/razorpay-client'

type Product = {
  id: string
  title: string
  description: string | null
  maker_id: string | null
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
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('sthamly_points, total_saved_rupees')
      .eq('id', user.id)
      .single()
    if (error) {
      console.error('profile refresh failed:', error)
      return
    }
    if (profile) {
      setPointsBalance(profile.sthamly_points)
      setTotalSaved(profile.total_saved_rupees)
    }
  }

  async function refreshCart(productMap?: Record<string, Product>) {
    if (!user) return
    const { data, error } = await supabase.from('cart_items').select('product_id, quantity').eq('user_id', user.id)
    if (error) {
      console.error('cart refresh failed:', error)
      return
    }
    if (data) {
      const map = productMap || Object.fromEntries(products.map((p) => [p.id, p]))
      setCart(data.map((c) => ({ ...c, product: map[c.product_id] })))
    }
  }

  async function loadProducts() {
    const { data: productData, error } = await supabase
      .from('products')
      .select('*, profiles:maker_id ( seller_verified )')
      .eq('is_active', true)

    if (error) {
      console.error('products fetch failed:', error)
    }

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
  }

  useEffect(() => {
    if (authLoading) return
    async function load() {
      await loadProducts()
      setLoading(false)
    }
    load()
  }, [authLoading, user])

  async function addToCart(productId: string) {
    if (!user) return
    const { error } = await supabase.rpc('add_to_cart', { p_product_id: productId, p_quantity: 1 })
    if (error) {
      console.error('add_to_cart failed:', error)
      alert('Cart mein add nahi ho paaya, dobara try karo.')
      return
    }
    await refreshCart()
  }

  async function setQuantity(productId: string, qty: number) {
    const safeQty = Math.max(qty, 0)
    const { error } = await supabase.rpc('set_cart_quantity', { p_product_id: productId, p_quantity: safeQty })
    if (error) {
      console.error('set_cart_quantity failed:', error)
      return
    }
    await refreshCart()
  }

  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0)
  const cartTotal = cart.reduce((sum, c) => sum + (c.product?.price || 0) * c.quantity, 0)
  const cartQuantityByProduct = Object.fromEntries(cart.map((c) => [c.product_id, c.quantity]))

  if (loading) {
    return <PageSkeleton rows={2} />
  }

  const filtered = products.filter((p) => (tab === 'services' ? p.is_service : !p.is_service))

  return (
    <div className="max-w-md mx-auto pb-24 relative">
      <header className="sticky top-0 bg-amber-50/95 dark:bg-stone-900/95 backdrop-blur px-4 py-4 border-b border-amber-100 dark:border-stone-800 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-heading font-semibold text-clay">Local Bazaar</h1>
            <p className="text-xs text-clay/70 mt-0.5">Handmade goods & services, direct from local makers</p>
          </div>
          <div className="flex items-center gap-2">
            {pointsBalance !== null && (
              <span className="text-xs font-bold bg-turmeric text-white px-3 py-1.5 rounded-full whitespace-nowrap">
                🪙 {pointsBalance}
              </span>
            )}
            <button onClick={() => setShowCart(true)} className="relative" aria-label="Cart">
              <ShoppingBag size={24} className="text-indigo-600 dark:text-indigo-400" />
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

        <div className="mt-3 flex gap-2 bg-white dark:bg-stone-800 rounded-xl p-1 border border-amber-100 dark:border-stone-700">
          <button
            onClick={() => setTab('products')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold ${
              tab === 'products' ? 'bg-clay text-white' : 'text-stone-500 dark:text-stone-400'
            }`}
          >
            🏺 Products
          </button>
          <button
            onClick={() => setTab('services')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold ${
              tab === 'services' ? 'bg-clay text-white' : 'text-stone-500 dark:text-stone-400'
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
            cartQuantity={cartQuantityByProduct[product.id] || 0}
            onRedeemed={refreshProfile}
            onAddToCart={() => addToCart(product.id)}
            onRemoveFromCart={() => setQuantity(product.id, 0)}
            onChanged={loadProducts}
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
          onCheckoutComplete={async () => {
            setShowCart(false)
            for (const line of cart) {
              await supabase.rpc('remove_from_cart', { p_product_id: line.product_id })
            }
            await refreshCart()
            await refreshProfile()
            alert('✓ Order confirmed! Seller will contact you soon.')
          }}
        />
      )}
    </div>
  )
}

function CartSheet({
  cart, total, onClose, onSetQuantity, onCheckoutComplete,
}: { cart: CartLine[]; total: number; onClose: () => void; onSetQuantity: (id: string, qty: number) => void; onCheckoutComplete: () => void }) {
  const { user } = useAuth()
  const [checkingOut, setCheckingOut] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')

  async function handleCheckout() {
    if (!user) return
    setCheckingOut(true)
    setCheckoutError('')

    try {
      const orderIds: string[] = []
      for (const line of cart) {
        const { data, error } = await supabase.rpc('create_order', {
          p_product_id: line.product_id,
          p_quantity: line.quantity,
          p_discount_amount: 0,
        })
        if (error || !data) throw new Error(error?.message || 'Order create fail')
        orderIds.push(data)
      }

      await startCheckout({
        sthamlyOrderIds: orderIds,
        buyerEmail: user.email,
        onSuccess: () => {
          setCheckingOut(false)
          onCheckoutComplete()
        },
        onFailure: (msg) => {
          setCheckingOut(false)
          setCheckoutError(msg)
        },
      })
    } catch (e: any) {
      setCheckingOut(false)
      setCheckoutError(e.message || 'Checkout fail ho gaya')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto bg-white dark:bg-stone-900 rounded-t-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-stone-900 px-4 py-3 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <h2 className="font-bold text-stone-900 dark:text-stone-100">झोला (Your Cart)</h2>
          <button onClick={onClose} className="text-2xl leading-none text-stone-400" aria-label="Close">×</button>
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
                <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">{c.product?.title}</p>
                <p className="text-xs text-clay font-bold">₹{c.product?.price}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSetQuantity(c.product_id, c.quantity - 1)}
                  className="w-7 h-7 rounded-full border border-stone-300 dark:border-stone-600 text-sm dark:text-stone-200"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="text-sm w-4 text-center dark:text-stone-200">{c.quantity}</span>
                <button
                  onClick={() => onSetQuantity(c.product_id, c.quantity + 1)}
                  className="w-7 h-7 rounded-full border border-stone-300 dark:border-stone-600 text-sm dark:text-stone-200"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="p-4 border-t border-stone-100 dark:border-stone-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-stone-700 dark:text-stone-300">Total</span>
              <span className="text-lg font-bold text-mehendi">₹{total.toFixed(0)}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={checkingOut}
              className="w-full bg-clay text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50"
            >
              {checkingOut ? 'Processing…' : `Pay ₹${total.toFixed(0)} via Razorpay`}
            </button>
            {checkoutError && <p className="text-xs text-red-600 mt-2 text-center">{checkoutError}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function ProductCard({
  product,
  pointsBalance,
  cartQuantity,
  onRedeemed,
  onAddToCart,
  onRemoveFromCart,
  onChanged,
}: {
  product: Product
  pointsBalance: number | null
  cartQuantity: number
  onRedeemed: () => void
  onAddToCart: () => void
  onRemoveFromCart: () => void
  onChanged: () => void
}) {
  const [pointsToUse, setPointsToUse] = useState(0)
  const [confirmedDiscount, setConfirmedDiscount] = useState(0)
  const [redeeming, setRedeeming] = useState(false)
  const [redeemError, setRedeemError] = useState('')
  const [redeemed, setRedeemed] = useState(false)
  const [booking, setBooking] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [booked, setBooked] = useState(false)
  const [added, setAdded] = useState(false)
  const [editing, setEditing] = useState(false)
  const { user } = useAuth()
  const router = useRouter()
  const isOwner = !!user && product.maker_id === user.id

  async function handleDelete() {
    if (!confirm('Ye product delete kar dein?')) return
    const { error } = await supabase.rpc('delete_product', { p_product_id: product.id })
    if (error) {
      console.error('delete_product failed:', error)
      alert('Delete nahi ho paaya, dobara try karo.')
      return
    }
    onChanged()
  }

  const cap = Math.min(product.max_discount_points, pointsBalance ?? 0)

  const previewDiscount = pointsToUse * product.points_to_rupee_ratio
  const activeDiscount = redeemed ? confirmedDiscount : previewDiscount
  const finalPrice = Math.max(product.price - activeDiscount, 0)

  // Points-redemption is a deliberately separate path from Cart +
  // Razorpay: redeeming immediately deducts points and hands off to a
  // direct chat with the seller (same shape as service bookings), so
  // it never overlaps with the in-app Razorpay checkout. If this
  // product was already sitting in the cart, it's removed the moment
  // points are redeemed — otherwise a buyer could redeem points AND
  // pay full price for the same item through the cart.
  async function confirmRedeem() {
    if (!user) { router.push('/login'); return }
    if (pointsToUse === 0) return
    setRedeeming(true)
    setRedeemError('')
    const { data, error } = await supabase.rpc('redeem_points', {
      p_product_id: product.id,
      p_points_to_use: pointsToUse,
    })
    setRedeeming(false)
    if (error || typeof data !== 'number') {
      console.error('redeem_points failed:', error)
      setRedeemError('Redeem nahi ho paaya, dobara try karo.')
      return
    }
    setConfirmedDiscount(data)
    setRedeemed(true)
    onRedeemed()

    if (cartQuantity > 0) {
      onRemoveFromCart()
    }

    // Hand off straight to chat to finalize the discounted purchase
    // with the seller directly, same as the booking flow does.
    const { data: convoId, error: convoError } = await supabase.rpc('start_conversation', {
      p_product_id: product.id,
    })
    if (!convoError && convoId) router.push(`/chat/${convoId}`)
  }

  async function chatToBargain() {
    if (!user) { router.push('/login'); return }
    const { data, error } = await supabase.rpc('start_conversation', {
      p_product_id: product.id,
    })
    if (error) {
      console.error('start_conversation failed:', error)
      return
    }
    if (data) router.push(`/chat/${data}`)
  }

  async function requestBooking() {
    if (!user) { router.push('/login'); return }
    setBooking(true)
    setBookingError('')
    const { error } = await supabase.rpc('request_booking', {
      p_service_id: product.id,
      p_requested_time: null,
      p_notes: null,
    })
    setBooking(false)
    if (error) {
      console.error('request_booking failed:', error)
      setBookingError('Booking request fail ho gayi, dobara try karo.')
      return
    }
    setBooked(true)
    const { data, error: convoError } = await supabase.rpc('start_conversation', { p_product_id: product.id })
    if (!convoError && data) router.push(`/chat/${data}`)
  }

  function handleAddToCart() {
    if (!user) { router.push('/login'); return }
    onAddToCart()
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-amber-100 dark:border-stone-800 overflow-hidden shadow-sm">
      <div className="w-full h-[280px] bg-stone-200 dark:bg-stone-800">
        {product.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.title} className="w-full h-full object-cover" />
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between">
          <p className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center flex-wrap gap-x-1">
            <span>by <span className="font-semibold text-stone-700 dark:text-stone-200">{product.maker_name}</span> · {product.maker_city}</span>
            {product.maker_verified && (
              <span className="inline-flex items-center gap-0.5 text-mehendi font-semibold">
                <VerifiedBadge size={12} /> Verified
              </span>
            )}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0">
            <ShareButton url="/bazaar" title={product.title} text={`${product.title} — ₹${product.price} on Sthamly`} />
            {!isOwner && user && (
              <button
                onClick={async () => {
                  const reason = prompt('Kya problem hai is listing mein?')
                  if (reason) {
                    const { error } = await supabase.rpc('report_listing', { p_product_id: product.id, p_reason: reason })
                    if (error) {
                      console.error('report_listing failed:', error)
                      alert('Report bhejne mein dikkat aayi, dobara try karo.')
                      return
                    }
                    alert('Report bhej diya. Dhanyawad.')
                  }
                }}
                className="text-stone-400 text-[10px] font-semibold px-2"
                aria-label="Report listing"
              >
                🚩
              </button>
            )}
            <OptionsMenu isOwner={isOwner} onEdit={() => setEditing(true)} onDelete={handleDelete} />
          </div>
        </div>
        <h2 className="font-bold text-stone-900 dark:text-stone-100 mt-1">{product.title}</h2>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">{product.description}</p>

        {editing && (
          <EditProductModal
            product={product}
            onClose={() => setEditing(false)}
            onSaved={() => { setEditing(false); onChanged() }}
          />
        )}
        {product.is_service && product.duration_minutes && (
          <p className="text-[11px] text-stone-400 mt-1">⏱ {product.duration_minutes} min</p>
        )}

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-extrabold text-stone-900 dark:text-stone-100">₹{finalPrice.toFixed(0)}</span>
          {activeDiscount > 0 && (
            <span className="text-sm line-through text-stone-400">₹{product.price.toFixed(0)}</span>
          )}
        </div>

        {!product.is_service && cap > 0 && !redeemed && (
          <div className="mt-3">
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mb-1">
              Use your points for a discount (up to {cap} pts) — seedha seller se chat karke settle karo
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
            {redeemError && <p className="text-xs text-red-600 mt-1">{redeemError}</p>}
          </div>
        )}

        {redeemed && (
          <p className="mt-3 text-xs font-semibold text-mehendi bg-mehendi/10 rounded-xl px-3 py-2 text-center">
            ✓ ₹{confirmedDiscount.toFixed(0)} discount locked in — chat khul gaya seller se finalize karne ke liye
          </p>
        )}

        {booked && (
          <p className="mt-3 text-xs font-semibold text-mehendi bg-mehendi/10 rounded-xl px-3 py-2 text-center">
            ✓ Booking requested — chat opened to confirm the time
          </p>
        )}
        {bookingError && <p className="mt-2 text-xs text-red-600 text-center">{bookingError}</p>}

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
              disabled={redeemed}
              className="flex-1 bg-clay text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50"
            >
              {redeemed ? 'Points redeemed — chat se lo' : added ? '✓ झोले में डाला' : 'झोले में डालें'}
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

function EditProductModal({
  product, onClose, onSaved,
}: { product: Product; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(product.title)
  const [description, setDescription] = useState(product.description || '')
  const [price, setPrice] = useState(String(product.price))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    const { error: rpcError } = await supabase.rpc('update_product', {
      p_product_id: product.id,
      p_title: title,
      p_description: description,
      p_price: Number(price),
      p_category: product.category,
      p_max_discount_points: product.max_discount_points,
    })
    setSaving(false)
    if (rpcError) {
      console.error('update_product failed:', rpcError)
      setError('Save nahi ho paaya, dobara try karo.')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-center justify-center px-6" onClick={onClose}>
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-stone-900 dark:text-stone-100 mb-3">Edit Product</h3>
        <div className="space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 rounded-xl px-3 py-2 text-sm"
            placeholder="Title"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 rounded-xl px-3 py-2 text-sm"
            placeholder="Description"
            rows={2}
          />
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full border border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 rounded-xl px-3 py-2 text-sm"
            placeholder="Price"
          />
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="flex-1 border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 py-2 rounded-xl text-sm">
            Cancel
          </button>
          <button onClick={save} disabled={saving} className="flex-1 bg-clay text-white py-2 rounded-xl text-sm disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
