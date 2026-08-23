import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { createClient } from '@supabase/supabase-js'

// Server-only route. RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set
// in Vercel's Environment Variables. Get them from your Razorpay
// Dashboard → Settings → API Keys (https://dashboard.razorpay.com/).
// NEXT_PUBLIC_RAZORPAY_KEY_ID (the public key only) is also needed on
// the client to open the checkout widget — see lib/razorpay-client.ts.

export async function POST(req: NextRequest) {
  try {
    const { sthamlyOrderIds } = await req.json()
    if (!Array.isArray(sthamlyOrderIds) || sthamlyOrderIds.length === 0) {
      return NextResponse.json({ error: 'sthamlyOrderIds (array) is required' }, { status: 400 })
    }

    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: 'Payments not configured yet — RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing on the server.' },
        { status: 500 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('id, total_amount, status')
      .in('id', sthamlyOrderIds)

    if (orderError || !orders || orders.length !== sthamlyOrderIds.length) {
      return NextResponse.json({ error: 'One or more orders not found' }, { status: 404 })
    }
    if (orders.some((o) => o.status !== 'created')) {
      return NextResponse.json({ error: 'One or more orders are not payable in their current status' }, { status: 400 })
    }

    const combinedTotal = orders.reduce((sum, o) => sum + Number(o.total_amount), 0)

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(combinedTotal * 100), // paise
      currency: 'INR',
      receipt: sthamlyOrderIds[0],
      notes: { sthamly_order_ids: sthamlyOrderIds.join(',') },
    })

    return NextResponse.json({
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId, // public key, safe to return to client
    })
  } catch (e: any) {
    console.error('create-order error:', e)
    return NextResponse.json({ error: e.message || 'Failed to create Razorpay order' }, { status: 500 })
  }
}
