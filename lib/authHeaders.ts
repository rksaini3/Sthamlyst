import { supabase } from './supabaseClient';

// Current logged-in user ka session token nikalta hai taaki API routes ko
// "Authorization: Bearer <token>" bheja ja sake. Ab koi bhi route body mein
// bheja gaya userId trust nahi karta — server khud token se real user
// nikalta hai (lib/requireUser.ts dekho), isliye yeh header har paid/account
// action ke fetch call mein zaroori hai.
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
