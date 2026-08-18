import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// flowType: 'implicit' — Google sends the login token back in the URL hash
// (#access_token=...) which the client picks up immediately on page load.
// This avoids needing a separate /auth/callback server route to "exchange"
// a PKCE code, which is what was silently failing before (the app came back
// from Google with an unprocessed ?code=... in the URL and nothing ever
// converted it into a real session, so the app kept saying "not signed in").
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
