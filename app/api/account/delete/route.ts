import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Pehle related data delete karo (foreign key constraints ki wajah se order zaroori hai)
    await supabase.from('wordpress_connections').delete().eq('user_id', userId);
    await supabase.from('shopify_connections').delete().eq('user_id', userId); // FIX: pehle missing tha
    await supabase.from('gbp_connections').delete().eq('user_id', userId);
    await supabase.from('agency_branding').delete().eq('user_id', userId); // FIX: pehle missing tha
    await supabase.from('push_subscriptions').delete().eq('user_id', userId); // FIX: pehle missing tha

    const { data: userAudits } = await supabase.from('audits').select('id').eq('user_id', userId);
    const auditIds = (userAudits ?? []).map((a) => a.id);

    if (auditIds.length > 0) {
      await supabase.from('ai_mentions').delete().in('audit_id', auditIds);
      await supabase.from('google_ai_overview_results').delete().in('audit_id', auditIds);
      await supabase.from('optimizations').delete().in('audit_id', auditIds);
    }

    await supabase.from('audits').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('id', userId);

    // Sabse aakhir mein — asli auth user delete karo (Supabase Admin API)
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error('Auth user delete failed:', authDeleteError.message);
      return NextResponse.json({ error: 'Account data delete hui, par login delete nahi ho paya. Support se contact karein.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Account deletion failed:', err);
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}
