import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase server env vars missing (check Vercel Environment Variables)');
  }
  return createClient(url, key);
}

function getRazorpay() {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('Razorpay env vars missing (check Vercel Environment Variables)');
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

const FIX_NOW_AMOUNT = 49900; // ₹499 in paise

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const razorpay = getRazorpay();

    const { sthamlyOrderIds } = await req.json();
    const optimizationId = sthamlyOrderIds?.[0];

    if (!optimizationId) {
      return NextResponse.json({ error: 'optimizationId missing' }, { status: 400 });
    }

    const { data: optimization, error } = await supabaseAdmin
      .from('optimizations')
      .select('*')
      .eq('id', optimizationId)
      .single();

    if (error || !optimization) {
      return NextResponse.json({ error: 'Optimization not found' }, { status: 404 });
    }

    const order = await razorpay.orders.create({
      amount: FIX_NOW_AMOUNT,
      currency: 'INR',
      receipt: `fixnow_${optimizationId}`,
    });

    return NextResponse.json({
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      razorpayOrderId: order.id,
    });
  } catch (err: any) {
    console.error('create-order error:', err);
    return NextResponse.json(
      { error: err.message || 'Order create nahi ho paya.' },
      { status: 500 }
    );
  }
}