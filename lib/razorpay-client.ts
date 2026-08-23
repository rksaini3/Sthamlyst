declare global {
  interface Window {
    Razorpay: any
  }
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false)
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export async function startCheckout({
  sthamlyOrderIds,
  buyerName,
  buyerEmail,
  onSuccess,
  onFailure,
}: {
  sthamlyOrderIds: string[]
  buyerName?: string
  buyerEmail?: string
  onSuccess: () => void
  onFailure: (message: string) => void
}) {
  const loaded = await loadRazorpayScript()
  if (!loaded) {
    onFailure('Payment script load nahi hua — internet check karo.')
    return
  }

  const createRes = await fetch('/api/checkout/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sthamlyOrderIds }),
  })
  const createData = await createRes.json()

  if (!createRes.ok) {
    onFailure(createData.error || 'Order create nahi ho paya.')
    return
  }

  const options = {
    key: createData.keyId,
    amount: createData.amount,
    currency: createData.currency,
    name: 'Sthamly',
    description: 'Local Bazaar Order',
    order_id: createData.razorpayOrderId,
    prefill: { name: buyerName, email: buyerEmail },
    theme: { color: '#B5451B' },
    handler: async (response: any) => {
      const verifyRes = await fetch('/api/checkout/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sthamlyOrderIds,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        }),
      })
      if (verifyRes.ok) {
        onSuccess()
      } else {
        const verifyData = await verifyRes.json()
        onFailure(verifyData.error || 'Payment verify nahi ho paya.')
      }
    },
    modal: {
      ondismiss: () => onFailure('Payment cancel kar diya gaya.'),
    },
  }

  const rzp = new window.Razorpay(options)
  rzp.open()
}
