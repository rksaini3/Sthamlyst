import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { decrypt } from '@/lib/crypto';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase server env vars missing (check Vercel Environment Variables)');
  }
  return createClient(url, key);
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

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new Error('RAZORPAY_KEY_SECRET missing (check Vercel Environment Variables)');
    }

    // Signature verify — yahi step confirm karta hai ki payment genuinely
    // Razorpay se hui hai, koi fake request nahi hai
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Signature mismatch' }, { status: 400 });
    }

    const { data: optimization, error } = await supabaseAdmin
      .from('optimizations')
      .update({ payment_status: 'paid' })
      .eq('id', optimizationId)
      .select()
      .single();

    if (error || !optimization) {
      return NextResponse.json({ error: 'Optimization not found' }, { status: 404 });
    }

    // Kaunsa platform connect hai uske hisaab se fix push karo —
    // WordPress ho ya Shopify, dono independent connections hain ek user ke liye
    const pushResult = optimization.wordpress_connection_id
      ? await pushFixToWordPress(supabaseAdmin, optimization)
      : optimization.shopify_connection_id
      ? await pushFixToShopify(supabaseAdmin, optimization)
      : { ok: false, error: 'No connected site (WordPress/Shopify) found for this account' };

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

async function pushFixToWordPress(supabaseAdmin: any, optimization: any) {
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

  // Password ab DB mein encrypted (AES-256-GCM) format mein save hoti hai —
  // WordPress ko Basic Auth bhejne se pehle usko decrypt karna zaroori hai.
  let plainPassword: string;
  try {
    plainPassword = decrypt(wpConnection.wp_app_password);
  } catch (e) {
    console.error('WordPress password decrypt failed:', e);
    return { ok: false, error: 'Saved WordPress credentials corrupt ho gayi hain — site ko dobara connect karein' };
  }

  const payload = buildWordPressFixPayload(optimization.fix_type);
  const auth = Buffer.from(`${wpConnection.wp_username}:${plainPassword}`).toString('base64');

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

function buildWordPressFixPayload(fixType: string) {
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

async function pushFixToShopify(supabaseAdmin: any, optimization: any) {
  if (!optimization.shopify_connection_id) {
    return { ok: false, error: 'No Shopify store connected for this account' };
  }

  const { data: shopifyConnection } = await supabaseAdmin
    .from('shopify_connections')
    .select('*')
    .eq('id', optimization.shopify_connection_id)
    .single();

  if (!shopifyConnection) {
    return { ok: false, error: 'Shopify connection not found' };
  }

  let plainToken: string;
  try {
    plainToken = decrypt(shopifyConnection.access_token);
  } catch (e) {
    console.error('Shopify token decrypt failed:', e);
    return { ok: false, error: 'Saved Shopify credentials corrupt ho gayi hain — store ko dobara connect karein' };
  }

  const { endpoint, body } = buildShopifyFixPayload(optimization.fix_type);

  const shopifyRes = await fetch(
    `https://${shopifyConnection.shop_domain}/admin/api/2024-01/${endpoint}`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': plainToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!shopifyRes.ok) {
    const errText = await shopifyRes.text();
    return { ok: false, error: `Shopify update failed: ${errText}` };
  }

  await supabaseAdmin
    .from('shopify_connections')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', shopifyConnection.id);

  return { ok: true };
}

function buildShopifyFixPayload(fixType: string): { endpoint: string; body: any } {
  switch (fixType) {
    case 'schema_markup':
      // Shopify pages ke liye direct <script> inject nahi hota — iske bajaye
      // ScriptTag API se site-wide JSON-LD schema script load karwate hain
      return {
        endpoint: 'script_tags.json',
        body: {
          script_tag: {
            event: 'onload',
            src: 'https://www.sthamly.com/schema/organization.js',
          },
        },
      };
    case 'faq_section':
      return {
        endpoint: 'pages.json',
        body: {
          page: {
            title: 'FAQ',
            body_html: '<h2>Frequently Asked Questions</h2>',
            published: true,
          },
        },
      };
    default:
      return {
        endpoint: 'pages.json',
        body: { page: { title: 'Update', body_html: '', published: false } },
      };
  }
}
