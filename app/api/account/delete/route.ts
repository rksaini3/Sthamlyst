import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { getSupabaseAdmin, requireUser } from '@/lib/requireUser';

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // FIX: userId ab body se nahi, sirf caller ke apne login-token se aata hai —
    // koi aur ka account delete nahi kar sakta.
    const auth = await requireUser(req, supabase);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    // FIX: agar Pro subscription active hai to Razorpay par bhi cancel karo,
    // warna account delete hone ke baad bhi billing chalti rehti thi
    const { data: profile } = await supabase
      .from('profiles')
      .select('razorpay_subscription_id')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.razorpay_subscription_id) {
      try {
        const razorpay = new Razorpay({
          key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
          key_secret: process.env.RAZORPAY_KEY_SECRET!,
        });
        await razorpay.subscriptions.cancel(profile.razorpay_subscription_id, false);
      } catch (e) {
        // Subscription pehle se cancel ho sakti hai — block mat karo, sirf log karo
        console.error('Razorpay subscription cancel failed (continuing with delete):', e);
      }
    }

    // Pehle related data delete karo (foreign key constraints ki wajah se order zaroori hai)
    await supabase.from('wordpress_connections').delete().eq('user_id', userId);
    await supabase.from('shopify_connections').delete().eq('user_id', userId);
    await supabase.from('gbp_connections').delete().eq('user_id', userId);
    await supabase.from('agency_branding').delete().eq('user_id', userId);
    await supabase.from('push_subscriptions').delete().eq('user_id', userId);

    const { data: userAudits } = await supabase.from('audits').select('id').eq('user_id', userId);
    const auditIds = (userAudits ?? []).map((a) => a.id);

    if (auditIds.length > 0) {
      await supabase.from('ai_mentions').delete().in('audit_id', auditIds);
      await supabase.from('google_ai_overview_results').delete().in('audit_id', auditIds);
      // NOTE: 'optimizations' (payment records) jaan-boojh kar delete NAHI karte —
      // yeh financial/billing history hai, account delete hone ke baad bhi rakhna
      // zaroori hai (dispute/refund/accounting ke liye). Audit ka reference chhoot
      // jaayega, par record surakshit rahega.
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
