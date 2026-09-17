import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key);
}

function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature');
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 });
  }

  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    console.error('Razorpay webhook: invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const supabase = getSupabaseAdmin();

  try {
    const eventType = event.event;
    const subscriptionEntity = event.payload?.subscription?.entity;
    const userId = subscriptionEntity?.notes?.userId;

    if (!userId) {
      console.error('Webhook missing userId in subscription notes:', eventType);
      return NextResponse.json({ received: true });
    }

    switch (eventType) {
      case 'subscription.activated':
      case 'subscription.charged':
        await supabase.from('profiles').update({ plan: 'pro' }).eq('id', userId);
        break;

      case 'subscription.cancelled':
      case 'subscription.completed':
      case 'subscription.halted':
        await supabase.from('profiles').update({ plan: 'free' }).eq('id', userId);
        break;

      default:
        // dusre events (pending, paused, etc.) — abhi kuch nahi karna
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook processing failed:', err);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}