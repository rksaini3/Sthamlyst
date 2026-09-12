import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const FIX_NOW_AMOUNT = 49900; // ₹499 in paise — change here to update price everywhere

export async function POST(req: NextRequest) {
  try {
    // sthamlyOrderIds[0] here is actually the optimizationId (see FixButton.tsx)
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