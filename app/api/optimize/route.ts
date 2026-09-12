import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lazy init — env var missing hone par sirf request fail ho, poora build nahi.
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
    const { optimizationId } = await req.json();

    if (!optimizationId) {
      return NextResponse.json({ error: 'optimizationId is required' }, { status: 400 });
    }

    // Row pehle se dashboard page ne bana di thi (status: pending, payment_status: unpaid).
    // Yahan hum usi row ko dhoondh ke, payment confirm karke, WordPress pe fix push karte hain.
    const { data: optimization, error: fetchErr } = await supabaseAdmin
      .from('optimizations')
      .select('*')
      .eq('id', optimizationId)
      .single();

    if (fetchErr || !optimization) {
      return NextResponse.json({ error: 'Optimization not found' }, { status: 404 });
    }

    await supabaseAdmin
      .from('optimizations')
      .update({ payment_status: 'paid' })
      .eq('id', optimizationId);

    if (!optimization.wordpress_connection_id) {
      await supabaseAdmin
        .from('optimizations')
        .update({ status: 'failed' })
        .eq('id', optimizationId);
      return NextResponse.json(
        { error: 'No WordPress site connected for this account' },
        { status: 400 }
      );
    }

    const { data: wpConnection } = await supabaseAdmin
      .from('wordpress_connections')
      .select('*')
      .eq('id', optimization.wordpress_connection_id)
      .single();

    if (!wpConnection) {
      await supabaseAdmin
        .from('optimizations')
        .update({ status: 'failed' })
        .eq('id', optimizationId);
      return NextResponse.json(
        { error: 'WordPress connection not found' },
        { status: 400 }
      );
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
      await supabaseAdmin
        .from('optimizations')
        .update({ status: 'failed' })
        .eq('id', optimizationId);
      const errText = await wpRes.text();
      throw new Error(`WordPress update failed: ${errText}`);
    }

    await supabaseAdmin
      .from('optimizations')
      .update({ status: 'applied', applied_at: new Date().toISOString() })
      .eq('id', optimizationId);

    await supabaseAdmin
      .from('wordpress_connections')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', wpConnection.id);

    return NextResponse.json({ success: true, optimizationId });
  } catch (err: any) {
    console.error('Optimize error:', err);
    return NextResponse.json(
      { error: err.message || 'Optimization failed' },
      { status: 500 }
    );
  }
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
