// app/api/notifications/subscribe/route.ts
// FIX: no cookie session in this app — verify the user via the Bearer
// access-token the client sends, using an anon-key client whose requests
// carry that token (so RLS policies see the real authenticated user).
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getUserSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getUserSupabase(token);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const subscription = await req.json();

  try {
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        subscription_json: subscription,
        is_active: true,
        last_renewed: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' } // matches the generated `endpoint` column in the SQL
    );

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscribe error:', error);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}
