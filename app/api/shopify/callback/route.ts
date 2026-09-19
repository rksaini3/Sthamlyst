import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { encrypt } from '@/lib/crypto';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Shopify har callback ke saath ek HMAC bhejta hai — isko verify karna zaroori hai,
// warna koi bhi fake "shop connected" request bhej sakta hai.
function verifyShopifyHmac(searchParams: URLSearchParams, secret: string): boolean {
  const hmac = searchParams.get('hmac');
  if (!hmac) return false;

  const params: string[] = [];
  searchParams.forEach((value, key) => {
    if (key !== 'hmac' && key !== 'signature') {
      params.push(`${key}=${value}`);
    }
  });
  params.sort();
  const message = params.join('&');

  const generatedHash = crypto.createHmac('sha256', secret).update(message).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(generatedHash), Buffer.from(hmac));
  } catch {
    // length mismatch bhi yahin catch ho jayega
    return false;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const shop = searchParams.get('shop');
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // hamara userId

  if (!shop || !code) {
    return NextResponse.redirect(new URL('/optimizer?shopify_error=missing_params', req.url));
  }

  const apiSecret = process.env.SHOPIFY_CLIENT_SECRET!;

  if (!verifyShopifyHmac(searchParams, apiSecret)) {
    return NextResponse.redirect(new URL('/optimizer?shopify_error=invalid_hmac', req.url));
  }

  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID,
        client_secret: apiSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error('Shopify token exchange failed');
    }

    const supabase = getSupabaseAdmin();
    const encryptedToken = encrypt(tokenData.access_token);

    await supabase.from('shopify_connections').insert({
      user_id: state,
      shop_domain: shop,
      access_token: encryptedToken,
    });

    return NextResponse.redirect(new URL('/optimizer?shopify_connected=1', req.url));
  } catch (err) {
    console.error('Shopify callback error:', err);
    return NextResponse.redirect(new URL('/optimizer?shopify_error=1', req.url));
  }
}
