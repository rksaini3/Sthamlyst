import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-side (service-role key) Supabase client — RLS bypass karta hai isliye
// isse chalane wale har route mein khud verify karna zaroori hai ki caller
// wahi user hai jiska data access/modify ho raha hai. Yahi kaam requireUser() karta hai.
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return createClient(url, key);
}

// Request ke "Authorization: Bearer <token>" header se real logged-in user
// nikalta hai — body mein bheja gaya userId KABHI trust nahi karna, koi bhi
// wahan apna man-chaaha ID daal sakta hai. Frontend se yeh token Supabase ki
// current session (`supabase.auth.getSession()`) se milta hai.
export async function requireUser(
  req: NextRequest,
  supabaseAdmin: SupabaseClient
): Promise<{ userId: string } | NextResponse> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return NextResponse.json({ error: 'Session expired, please login again' }, { status: 401 });
  }

  return { userId: data.user.id };
}
