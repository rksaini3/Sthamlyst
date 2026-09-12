'use client';

import { supabase } from '@/lib/supabaseClient';

export default function ConnectGBPButton() {
  async function handleConnect() {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) {
      window.location.href = '/login';
      return;
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/api/gbp/callback`;
    const scope = 'https://www.googleapis.com/auth/business.manage';
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${userId}`;

    window.location.href = url;
  }

  return (
    <button
      onClick={handleConnect}
      className="w-full border rounded-lg py-3 font-semibold flex items-center justify-center gap-2"
    >
      Connect Your Google Business Listing
    </button>
  );
}