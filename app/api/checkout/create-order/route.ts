import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { getSupabaseAdmin, requireUser } from '@/lib/requireUser';

function getRazorpay() {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('Razorpay env vars missing (check Vercel Environment Variables)');
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

const INTRO_AMOUNT = 100; // ₹1 in paise — sirf pehli baar milta hai (account ki poori life mein ek baar)
const REGULAR_FIX_AMOUNT = 49900; // ₹499 in paise — dusri baar se one-time fix ka normal price

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // FIX: userId ab sirf login-token se aata hai, body se nahi
    const auth = await requireUser(req, supabaseAdmin);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const { sthamlyOrderIds } = await req.json();
    const optimizationId = sthamlyOrderIds?.[0];

    if (!optimizationId) {
      return NextResponse.json({ error: 'optimizationId missing' }, { status: 400 });
    }

    const { data: optimization, error } = await supabaseAdmin
      .from('optimizations')
      .select('*, audits(user_id)')
      .eq('id', optimizationId)
      .single();

    if (error || !optimization) {
      return NextResponse.json({ error: 'Optimization not found' }, { status: 404 });
    }

    const ownerId = (optimization as any).audits?.user_id;
    if (!ownerId) {
      return NextResponse.json({ error: 'User not linked to this optimization' }, { status: 400 });
    }

    // FIX: sirf isi optimization ka asli malik hi iske liye payment order bana sake
    if (ownerId !== userId) {
      return NextResponse.json({ error: 'Yeh fix aapke account ka nahi hai' }, { status: 403 });
    }

    const razorpay = getRazorpay();

    // Paisa lene se PEHLE check: site connected hai? (warna customer pay karke bhi fix nahi paata)
    if (!optimization.wordpress_connection_id) {
      return NextResponse.json(
        { error: 'Pehle apni WordPress site connect karein — bina site ke payment nahi liya jayega.' },
        { status: 400 }
      );
    }

    if (optimization.payment_status === 'paid') {
      return NextResponse.json(
        {
          error:
            optimization.status === 'applied'
              ? 'Ye fix pehle hi apply ho chuka hai.'
              : 'Is fix ka payment ho chuka hai par fix apply nahi hua — support se sampark karein, dobara payment nahi lena padega.',
        },
        { status: 409 }
      );
    }

    // Price sirf yahin, server par decide hoti hai — frontend se koi bhi
    // amount tamper nahi kar sakta, chahe DevTools se try kare
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('intro_price_used')
      .eq('id', userId)
      .single();

    const isIntroEligible = !profile?.intro_price_used;
    const amount = isIntroEligible ? INTRO_AMOUNT : REGULAR_FIX_AMOUNT;

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `fixnow_${optimizationId}`,
      notes: {
        userId,
        priceType: isIntroEligible ? 'intro' : 'regular',
      },
    });

    return NextResponse.json({
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      razorpayOrderId: order.id,
      priceType: isIntroEligible ? 'intro' : 'regular',
    });
  } catch (err: any) {
    console.error('create-order error:', err);
    return NextResponse.json(
      { error: err.message || 'Order create nahi ho paya.' },
      { status: 500 }
    );
  }
}