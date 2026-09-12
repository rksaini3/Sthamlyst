import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const {
      sthamlyOrderIds, // [0] = optimizationId
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = await req.json();

    const optimizationId = sthamlyOrderIds?.[0];

    // 1. Verify Razorpay signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Signature mismatch' }, { status: 400 });
    }

    // 2. Mark optimization as paid
    const { data: optimization, error } = await supabaseAdmin
      .from('optimizations')
      .update({ payment_status: 'paid' })
      .eq('id', optimizationId)
      .select()
      .single();

    if (error || !optimization) {
      return NextResponse.json({ error: 'Optimization not found' }, { status: 404 });
    }

    // 3. Push the actual fix to WordPress
    const pushResult = await pushFixToWordPress(optimization);
    if (!pushResult.ok) {
      await supabaseAdmin
        .from('optimizations')
        .update({ status: 'failed' })
        .eq('id', optimizationId);
      return NextResponse.json({ error: pushResult.error }, { status: 500 });
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

async function pushFixToWordPress(optimization: any) {
  if (!optimization.wordpress_connection_id) {
    return { ok: false, error: 'No WordPress site connected for this account' };
  }

  const { data: wpConnection } = await supabaseAdmin
    .from('wordpress_connections')
    .select('*')
    .eq('id', optimization.wordpress_connection_id)
    .single();

  if (!wpConnection) {
    return { ok: false, error: 'WordPress connection not found' };
  }

  const payload = buildFixPayload(optimization.fix_type);
  const auth = Buffer.from(
    `${wpConnection.wp_username}:${wpConnection.wp_app_password}`
  ).toString('base64');

  const wpRes = await fetch(`${wpConnection.site_url}/wp-json/wp/v2/pages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!wpRes.ok) {
    const errText = await wpRes.text();
    return { ok: false, error: `WordPress update failed: ${errText}` };
  }

  await supabaseAdmin
    .from('wordpress_connections')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', wpConnection.id);

  return { ok: true };
}

function buildFixPayload(fixType: string) {
  switch (fixType) {
    case 'schema_markup':
      return {
        title: 'AI Visibility Schema Update',
        content:
          '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization"}</script>',
        status: 'publish',
      };
    case 'faq_section':
      return {
        title: 'FAQ',
        content: '<h2>Frequently Asked Questions</h2>',
        status: 'publish',
      };
    default:
      return { title: 'Update', content: '', status: 'draft' };
  }
}