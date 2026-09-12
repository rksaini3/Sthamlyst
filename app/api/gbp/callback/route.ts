import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(new URL('/optimizer?gbp_error=1', req.url));
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${req.nextUrl.origin}/api/gbp/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();

    if (!tokens.access_token) {
      throw new Error('Google token exchange failed');
    }

    // Cookie se logged-in user ka session nahi milta server route mein seedha,
    // isliye state param mein userId bhejna behtar hai — abhi ke liye
    // client-side redirect ke baad userId Supabase se dobara fetch karke
    // is row ko update karne ka tareeka use karenge (Optimizer page par).
    const supabase = getSupabaseAdmin();
    await supabase.from('gbp_connections').insert({
      user_id: req.nextUrl.searchParams.get('state'), // login page se state=userId bhejna hoga
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
    });

    return NextResponse.redirect(new URL('/optimizer?gbp_connected=1', req.url));
  } catch (err) {
    return NextResponse.redirect(new URL('/optimizer?gbp_error=1', req.url));
  }
}