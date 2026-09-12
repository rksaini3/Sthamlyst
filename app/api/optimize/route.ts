import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { auditId, fixType, wordpressConnectionId } = await req.json();

    if (!auditId || !fixType) {
      return NextResponse.json(
        { error: 'auditId and fixType are required' },
        { status: 400 }
      );
    }

    const { data: optimization, error: insertErr } = await supabaseAdmin
      .from('optimizations')
      .insert({
        audit_id: auditId,
        wordpress_connection_id: wordpressConnectionId ?? null,
        fix_type: fixType,
        status: 'pending',
        payment_status: 'paid',
      })
      .select()
      .single();

    if (insertErr || !optimization) throw insertErr;

    let wpConnection = null;
    if (wordpressConnectionId) {
      const { data } = await supabaseAdmin
        .from('wordpress_connections')
        .select('*')
        .eq('id', wordpressConnectionId)
        .single();
      wpConnection = data;
    }

    if (!wpConnection) {
      await supabaseAdmin
        .from('optimizations')
        .update({ status: 'failed' })
        .eq('id', optimization.id);
      return NextResponse.json(
        { error: 'No WordPress site connected for this account' },
        { status: 400 }
      );
    }

    const payload = buildFixPayload(fixType);

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
        .eq('id', optimization.id);
      const errText = await wpRes.text();
      throw new Error(`WordPress update failed: ${errText}`);
    }

    await supabaseAdmin
      .from('optimizations')
      .update({ status: 'applied', applied_at: new Date().toISOString() })
      .eq('id', optimization.id);

    await supabaseAdmin
      .from('wordpress_connections')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', wordpressConnectionId);

    return NextResponse.json({ success: true, optimizationId: optimization.id });
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