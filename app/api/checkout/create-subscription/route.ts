import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';

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
  const { userId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const razorpay = getRazorpay();

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('intro_price_used')
    .eq('id', userId)
    .single();

  // Case A: Intro ₹1 pehle hi use ho chuka — seedha normal subscription
  // shuru karo, koi free month nahi, turant ₹999/month billing start
  if (profile?.intro_price_used) {
    const subscription = await razorpay.subscriptions.create({
      plan_id: process.env.RAZORPAY_MONTHLY_PLAN_ID!,
      customer_notify: 1,
      total_count: 120,
      notes: { userId },
    });

    return NextResponse.json({
      requiresIntroPayment: false,
      subscriptionId: subscription.id,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  }

  // Case B: Pehli baar — pehle ₹1 charge karo, subscription abhi nahi banega
  // (yeh /activate route par ₹1 confirm hone ke baad banega)
  const order = await razorpay.orders.create({
    amount: 100, // ₹1 in paise
    currency: 'INR',
    receipt: `intro_sub_${userId}`,
    notes: { userId, priceType: 'intro_subscription' },
  });

  return NextResponse.json({
    requiresIntroPayment: true,
    razorpayOrderId: order.id,
    amount: order.amount,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  });
}
