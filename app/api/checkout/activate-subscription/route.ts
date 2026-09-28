import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { getSupabaseAdmin, requireUser } from '@/lib/requireUser';

function getRazorpay() {
  return new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // FIX: userId ab sirf login-token se aata hai, body se nahi
    const auth = await requireUser(req, supabaseAdmin);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET!;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (!safeEqual(expectedSignature, String(razorpay_signature))) {
      return NextResponse.json({ error: 'Signature mismatch' }, { status: 400 });
    }

    // FIX (replay bug): sirf signature match hona kaafi nahi tha — ek hi valid
    // order_id/payment_id/signature triple baar-baar bhejkar pehle anlimited
    // free-month subscriptions ban sakti thi. Ab Razorpay se order khud fetch
    // karke verify karte hain ki yeh WAHI ₹1 intro order tha, ISI user ka tha,
    // aur genuinely "paid" hai.
    const razorpayOrder = await getRazorpay().orders.fetch(razorpay_order_id);

    if (razorpayOrder.receipt !== `intro_sub_${userId}`) {
      return NextResponse.json({ error: 'Payment is is account se match nahi karta' }, { status: 400 });
    }
    if (razorpayOrder.notes?.priceType !== 'intro_subscription') {
      return NextResponse.json({ error: 'Invalid order type' }, { status: 400 });
    }
    if (razorpayOrder.status !== 'paid') {
      return NextResponse.json({ error: 'Payment abhi confirm nahi hua' }, { status: 400 });
    }

    // FIX (replay bug): agar intro pehle hi use ho chuka hai (aur subscription
    // already ban chuki hai), to dobara free-month subscription mat banao —
    // yehi asli replay-protection hai.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('intro_price_used, razorpay_subscription_id')
      .eq('id', userId)
      .single();

    if (profile?.intro_price_used && profile?.razorpay_subscription_id) {
      return NextResponse.json({ error: 'Intro offer already used on this account' }, { status: 409 });
    }

    // ₹1 payment confirm — ab is account ka intro price hamesha ke liye use ho gaya
    await supabaseAdmin.from('profiles').update({ intro_price_used: true }).eq('id', userId);

    // Subscription banao, lekin billing 30 din baad shuru ho (1 month free)
    const startAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    const subscription = await getRazorpay().subscriptions.create({
      plan_id: process.env.RAZORPAY_AGENCY_PLAN_ID!,
      customer_notify: 1,
      total_count: 120,
      start_at: startAt,
      notes: { userId, freeMonthUntil: String(startAt) },
    });

    await supabaseAdmin
      .from('profiles')
      .update({ razorpay_subscription_id: subscription.id })
      .eq('id', userId);

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
