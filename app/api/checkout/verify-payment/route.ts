import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { decrypt } from '@/lib/crypto';
import { applyWordPressFixes, type FixResult } from '@/lib/siteFixes';
import type { BrandInfo } from '@/lib/fixContent';

export const runtime = 'nodejs';
export const maxDuration = 60; // FAQ generation + site API calls mein thoda time lag sakta hai

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase server env vars missing (check Vercel Environment Variables)');
  }
  return createClient(url, key);
}

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

    const {
      sthamlyOrderIds,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = await req.json();

    const optimizationId = sthamlyOrderIds?.[0];

    if (!optimizationId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Payment details incomplete' }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new Error('RAZORPAY_KEY_SECRET missing (check Vercel Environment Variables)');
    }

    // Signature verify — confirm karta hai payment genuinely Razorpay se hui hai
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (!safeEqual(expectedSignature, String(razorpay_signature))) {
      return NextResponse.json({ error: 'Signature mismatch' }, { status: 400 });
    }

    const { data: optimization, error } = await supabaseAdmin
      .from('optimizations')
      .select('*, audits(user_id, brand_name, target_city, website_url)')
      .eq('id', optimizationId)
      .single();

    if (error || !optimization) {
      return NextResponse.json({ error: 'Optimization not found' }, { status: 404 });
    }

    // Idempotency: same payment dobara aaye to fix dobara push nahi karte
    if (optimization.payment_status === 'paid' && optimization.status === 'applied') {
      return NextResponse.json({ success: true, alreadyApplied: true });
    }

    // Razorpay ke apne stored order data se check karte hain (client se nahi aata, isliye tamper-proof)
    let razorpayOrder: any;
    try {
      razorpayOrder = await getRazorpay().orders.fetch(razorpay_order_id);
    } catch (e) {
      console.error('Razorpay order fetch failed:', e);
      return NextResponse.json({ error: 'Payment order verify nahi ho paya, thodi der baad try karein' }, { status: 502 });
    }

    // Ye payment isi optimization ke liye bana tha? (ek payment se dusre optimization par fix chalane se rokta hai)
    if (razorpayOrder.receipt !== `fixnow_${optimizationId}`) {
      return NextResponse.json({ error: 'Payment is fix se match nahi karta' }, { status: 400 });
    }

    const audit = (optimization as any).audits;
    const userId = audit?.user_id;
    const priceType = razorpayOrder.notes?.priceType;

    if (priceType === 'intro' && userId) {
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .update({ intro_price_used: true })
        .eq('id', userId);
      if (profileErr) console.error('Intro-price flag update failed (non-blocking):', profileErr.message);
    }

    await supabaseAdmin
      .from('optimizations')
      .update({ payment_status: 'paid' })
      .eq('id', optimizationId);

    const brand: BrandInfo = {
      brandName: audit?.brand_name ?? '',
      city: audit?.target_city ?? '',
      websiteUrl: audit?.website_url ?? null,
    };

    let pushResult: FixResult;
    if (optimization.wordpress_connection_id) {
      pushResult = await pushFixToWordPress(supabaseAdmin, optimization, brand);
    } else {
      pushResult = { ok: false, error: 'Koi connected WordPress site nahi mili' };
    }

    if (!pushResult.ok) {
      await supabaseAdmin
        .from('optimizations')
        .update({ status: 'failed' })
        .eq('id', optimizationId);
      return NextResponse.json(
        { error: `Payment mil gaya par fix apply nahi hua: ${pushResult.error}. Support se sampark karein, dobara payment nahi lena padega.` },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from('optimizations')
      .update({ status: 'applied', applied_at: new Date().toISOString() })
      .eq('id', optimizationId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('verify-payment error:', err);
    return NextResponse.json(
      { error: err.message || 'Payment verify nahi ho paya.' },
      { status: 500 }
    );
  }
}

async function pushFixToWordPress(supabaseAdmin: any, optimization: any, brand: BrandInfo): Promise<FixResult> {
  const { data: wpConnection } = await supabaseAdmin
    .from('wordpress_connections')
    .select('*')
    .eq('id', optimization.wordpress_connection_id)
    .single();

  if (!wpConnection) {
    return { ok: false, error: 'WordPress connection not found' };
  }

  let plainPassword: string;
  try {
    plainPassword = decrypt(wpConnection.wp_app_password);
  } catch (e) {
    console.error('WordPress password decrypt failed:', e);
    return { ok: false, error: 'Saved WordPress credentials corrupt ho gayi hain — site ko dobara connect karein' };
  }

  const result = await applyWordPressFixes(
    { site_url: wpConnection.site_url, wp_username: wpConnection.wp_username, password: plainPassword },
    brand,
    optimization.fix_type
  );

  if (result.ok) {
    await supabaseAdmin
      .from('wordpress_connections')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', wpConnection.id);
  }

  return result;
}
