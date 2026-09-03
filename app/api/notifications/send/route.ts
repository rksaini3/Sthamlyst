// app/api/notifications/send/route.ts
// FIX: writes into your EXISTING `notifications` table (id, user_id,
// category, title, body, is_read, created_at) instead of a new,
// disconnected table — so a push also shows up in the app's
// Notifications page. `category` must be one of the 4 values your
// notifications page already understands: reward | order | social | learning.
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

webpush.setVapidDetails(
  `mailto:${process.env.PUSH_EMAIL}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const VALID_CATEGORIES = ['reward', 'order', 'social', 'learning'] as const;
type Category = (typeof VALID_CATEGORIES)[number];

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, title, body, url = '/', category } = await req.json();

  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  try {
    // 1. Always create the in-app notification row — this is what your
    //    Notifications page reads, push or no push.
    const { error: insertError } = await supabase.from('notifications').insert({
      user_id: userId,
      category: category as Category,
      title,
      body,
      is_read: false,
    });
    if (insertError) throw insertError;

    // 2. Best-effort browser push on top of that, if the user has an
    //    active subscription. A push failure should never block the
    //    in-app notification that was already saved above.
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('subscription_json')
      .eq('user_id', userId)
      .eq('is_active', true);

    let sent = 0;
    if (subscriptions && subscriptions.length > 0) {
      const results = await Promise.allSettled(
        subscriptions.map((sub) =>
          webpush.sendNotification(
            sub.subscription_json,
            JSON.stringify({ title, body, url, tag: category })
          )
        )
      );
      sent = results.filter((r) => r.status === 'fulfilled').length;
    }

    return NextResponse.json({ saved: true, sent, totalSubscriptions: subscriptions?.length ?? 0 });
  } catch (error) {
    console.error('Send notification error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
