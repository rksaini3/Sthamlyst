import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';

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

  const razorpay = getRazorpay();
  const subscription = await razorpay.subscriptions.create({
    plan_id: process.env.RAZORPAY_MONTHLY_PLAN_ID!,
    customer_notify: 1,
    total_count: 120,
    notes: { userId },
  });

  return NextResponse.json({
    subscriptionId: subscription.id,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  });
}