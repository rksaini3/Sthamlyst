import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto';
import { getSupabaseAdmin, requireUser } from '@/lib/requireUser';

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // FIX: userId ab sirf login-token se aata hai, body se nahi
    const auth = await requireUser(req, supabase);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const { siteUrl, wpUsername, wpAppPassword } = await req.json();

    if (!siteUrl || !wpUsername || !wpAppPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Basic validation — sirf http(s) URLs allow, warna aage server-side fetch
    // (fix push karte waqt) kisi internal/malicious address ko hit kar sakta hai
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(siteUrl);
    } catch {
      return NextResponse.json({ error: 'Website URL sahi format mein nahi hai' }, { status: 400 });
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'Sirf http:// ya https:// URLs allowed hain' }, { status: 400 });
    }

    const encryptedPassword = encrypt(wpAppPassword);

    const { error } = await supabase.from('wordpress_connections').insert({
      user_id: userId,
      site_url: parsedUrl.toString(),
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
