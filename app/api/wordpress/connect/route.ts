import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encrypt } from '@/lib/crypto';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const { userId, siteUrl, wpUsername, wpAppPassword } = await req.json();

    if (!userId || !siteUrl || !wpUsername || !wpAppPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const encryptedPassword = encrypt(wpAppPassword);

    const { error } = await supabase.from('wordpress_connections').insert({
      user_id: userId,
      site_url: siteUrl,
      wp_username: wpUsername,
      wp_app_password: encryptedPassword,
    });

    if (error) {
      console.error('wordpress_connections insert failed:', error.message);
      return NextResponse.json({ error: 'Could not save connection' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('WordPress connect failed:', err);
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}