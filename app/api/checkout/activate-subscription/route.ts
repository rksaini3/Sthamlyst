import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getRazorpay() {
  return new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

export async function POST(req: NextRequest) {
  try {
    const {
      userId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = await req.json();

    if (!userId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET!;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Signature mismatch' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const razorpay = getRazorpay();

    // ₹1 payment confirm — ab is account ka intro price hamesha ke liye use ho gaya
    await supabaseAdmin
      .from('profiles')
      .update({ intro_price_used: true })
      .eq('id', userId);

    // Subscription banao, lekin billing 30 din baad shuru ho (1 month free)
    const startAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    const subscription = await razorpay.subscriptions.create({
      plan_id: process.env.RAZORPAY_MONTHLY_PLAN_ID!,
      customer_notify: 1,
      total_count: 120,
      start_at: startAt,
      notes: { userId, freeMonthUntil: String(startAt) },
    });

    return NextResponse.json({
      subscriptionId: subscription.id,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (err: any) {
    console.error('activate-subscription error:', err);
    return NextResponse.json(
      { error: err.message || 'Subscription activate nahi ho payi.' },
      { status: 500 }
    );
  }
}
