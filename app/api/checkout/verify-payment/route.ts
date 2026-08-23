import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// Verifies the HMAC-SHA256 signature Razorpay sends back after a
// successful checkout, so a payment can never be faked from the client.
// See: https://razorpay.com/docs/payments/server-integration/nodejs/payment-gateway/build-integration/#3-verify-payment-signature

export async function POST(req: NextRequest) {
  try {
    const {
      sthamlyOrderIds,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = await req.json()

    if (!Array.isArray(sthamlyOrderIds) || sthamlyOrderIds.length === 0) {
      return NextResponse.json({ error: 'sthamlyOrderIds (array) is required' }, { status: 400 })
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keySecret) {
      return NextResponse.json({ error: 'Payments not configured on the server.' }, { status: 500 })
    }

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Payment signature mismatch — possible tampering.' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    for (const orderId of sthamlyOrderIds) {
      const { error } = await supabase.rpc('confirm_order_payment', {
        p_order_id: orderId,
        p_razorpay_order_id: razorpay_order_id,
        p_razorpay_payment_id: razorpay_payment_id,
        p_razorpay_signature: razorpay_signature,
      })
      if (error) {
        console.error(`confirm_order_payment error for ${orderId}:`, error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ verified: true })
  } catch (e: any) {
    console.error('verify-payment error:', e)
    return NextResponse.json({ error: e.message || 'Verification failed' }, { status: 500 })
  }
}
