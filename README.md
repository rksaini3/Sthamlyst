# Sthamly — AI Visibility Audit

Next.js 14 + Tailwind + Supabase. Business ka naam kisi bhi city ke liye ChatGPT, Gemini,
Perplexity aur Google mein check karta hai ki AI models use pehchante hain ya nahi, ek
PDF report deta hai, aur WordPress site par ek-click fix (schema + FAQ) laga deta hai.

> Is repo ka naam `sthamly-mvp` hai, par isme MVP se aage ke (abhi experimental/未-verified)
> features bhi hain — Shopify, Google Business Profile, Web3 Verified ID, agency tools.
> Neeche "Feature status" section mein saaf likha hai kaun sa hissa production-ready hai.

## 1. Local setup

```bash
npm install
cp .env.local.example .env.local
# .env.local mein neeche di gayi env vars bharo (section 3 dekho)
npm run dev
```

Kholo http://localhost:3000

## 2. Database (Supabase) — ⚠️ zaroori, dhyan se padhein

**Is repo mein currently jitni bhi `.sql` files hain, unme se koi bhi `audits`,
`ai_mentions`, `optimizations`, `wordpress_connections`, `shopify_connections`, ya
`google_ai_overview_results` table define nahi karti — jabki poora AI Visibility Audit
product inhi tables par chalta hai.**

Iska matlab: ye tables aapke live Supabase project mein pehle se maujood hain (kisi purane
commit ya hand-edit se), par unka SQL is repo mein track nahi hai. Naye machine/naye
Supabase project par is repo se seedha deploy karoge to app **crash hoga** jab tak ye
tables khud na banayein.

**Karna kya hai:**
1. Apne live Supabase project mein: Table Editor khol kar upar di gayi 6 tables ke columns
   note kar lo (ya Database → Backups → SQL export nikaal lo).
2. Un tables ka `CREATE TABLE` SQL is repo mein `sthamly-schema-audit-core.sql` (naya file)
   ke naam se add kar do, taaki future mein koi bhi is repo se fresh Supabase project setup
   kar sake.

**Jo SQL files repo mein hain, unka istemal:**

| File | Kya hai |
|---|---|
| `sthamly-schema-COMPLETE.sql` | Purana "Learn & Earn" pivot ka consolidated schema (v2–v7). Agar aap sirf AI Visibility Audit chala rahe ho to **iski zaroorat nahi**. |
| `sthamly-schema-v9.sql` se `v18.sql` | Learn & Earn ke aage ke features (stories, likes, orders, mohalla-scores, etc.) — audit product se **anrelated**, mat chalao jab tak wo features chahiye na ho. |
| `sthamly-ecosystem-schema-v3.sql` | Learn & Earn ecosystem ka hissa — audit product se anrelated. |
| `sthamly-web3-schema.sql` | `issuer_keys` + `verified_credentials` tables — sirf tab chalao jab Web3 Verified ID feature use karna ho (section 5 dekho). |

**Chalane ka tareeka (jab file taiyar ho):** Supabase Dashboard → SQL Editor → New Query →
poori file paste karo → Run.

## 3. Environment variables

`.env.local.example` mein saari zaroori keys hain. Kaam ke hisaab se:

**Core (bina inke app bilkul nahi chalega):**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  — Supabase Project Settings → API se.
- `ENCRYPTION_KEY` — WordPress/Shopify password DB mein encrypt karne ke liye. Banao:
  `openssl rand -hex 32` (poore 64 hex characters chahiye).
- `OPENROUTER_API_KEY` — ChatGPT + Perplexity audit checks isi se route hote hain
  (https://openrouter.ai/keys).
- `SERPER_API_KEY` — Google search/AI Overview check ke liye (https://serper.dev/).
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — Fix Now payment ke liye.

**Sirf tab chahiye jab wo feature use karna ho:**
- `RAZORPAY_MONTHLY_PLAN_ID`, `RAZORPAY_WEBHOOK_SECRET` — Pro (₹999/माह) subscription.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google Business Profile connect.
- `NEXT_PUBLIC_SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_API_VERSION` — Shopify fix.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — Push notifications
  (`npx web-push generate-vapid-keys`).
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — Feedback button ka Telegram alert.
- `INTERNAL_API_KEY` — server-to-server push trigger auth.
- `NEXT_PUBLIC_SITE_URL` — Verified ID / DID document URLs banane ke liye (default:
  `https://www.sthamly.com`).

Vercel par deploy karte waqt yahi saari keys **Project → Settings → Environment
Variables** mein bhi daalni hongi.

## 4. Feature status (kya production-ready hai, kya nahi)

| Feature | Status |
|---|---|
| Free AI Visibility Audit (ChatGPT, Perplexity, Google) | ✅ Core, tested |
| Gap Report PDF (pehle audit par kamiyaan) | ✅ Core |
| WordPress auto-fix (Organization schema + FAQ page) | ✅ Core |
| Before/After Report PDF | ✅ Core |
| Fix Now payment (Razorpay) | ✅ Core, replay-safe |
| Shopify auto-fix | ⚠️ Bana hai, par schema sirf JS script tag se lagti hai — kuch AI crawlers ise nahi padhte. Production se pehle test karo. |
| Google Business Profile connect | ⚠️ OAuth callback bana hai, auto-fix ka actual push code verify nahi kiya gaya. |
| Pro (₹999/माह) monitoring subscription | ⚠️ Checkout/webhook routes hain, par "har mahine apne-aap audit" wala cron/scheduler is repo mein nahi mila — bechne se pehle confirm karo ki wo chalta hai. |
| Web3 Verified Business ID (DID) | ⚠️ Optional, alag feature. Ranking/AI visibility par koi seedha asar nahi — sirf ek public "proof" page/badge hai. `sthamly-web3-schema.sql` chalana zaroori hai isse pehle. |
| Agency white-label (agency ka naam PDF par) | ✅ Dashboard mein chhota input, PDF mein "prepared by" ke roop mein aata hai |
| Push notifications, Telegram feedback | ⚠️ Optional, apni zaroorat ke hisaab se env vars daal kar enable karo |

## 5. Routes ka nakksha

```
app/
  page.tsx                         → Home: free audit form
  dashboard/page.tsx               → Audit result, Gap/Before-After PDF, Fix Now
  optimizer/page.tsx               → WordPress/Shopify site connect
  login/page.tsx, profile/, settings/, terms/, privacy/
  verify/[id]/page.tsx             → Public Verified ID page (Web3, optional)

app/api/
  audit/route.ts                   → Free audit chalata hai (AI models + Google)
  checkout/create-order|verify-payment/route.ts   → Fix Now payment
  checkout/create-subscription|activate-subscription/route.ts → Pro subscription
  webhooks/razorpay/route.ts       → Razorpay webhook
  report/gap/route.ts              → Gap Report PDF
  report/before-after/route.ts     → Before/After Report PDF
  wordpress/connect/route.ts       → WordPress site connect (App Password)
  shopify/callback/route.ts        → Shopify OAuth
  gbp/callback/route.ts            → Google Business Profile OAuth
  verified/*, schema/organization, business/[id]/did.json, .well-known/did.json
                                    → Web3 Verified ID (optional)
  notifications/subscribe|unsubscribe/route.ts → Push notifications
  feedback/route.ts                → Telegram feedback
  account/delete/route.ts          → Account deletion
```

## 6. Push to GitHub

```bash
git init
git add .
git commit -m "Sthamly AI Visibility Audit"
git branch -M main
git remote add origin https://github.com/<your-username>/sthamly.git
git push -u origin main
```

## 7. Deploy to Vercel

1. vercel.com → Sign in with GitHub
2. **Add New → Project** → apna repo select karo → **Import**
3. Section 3 ki saari zaroori Environment Variables daalo
4. **Deploy**

Deploy hone ke baad ek baar khud apni WordPress site connect karke poora flow test karo:
audit → Gap PDF → Fix Now (test payment) → Before/After PDF.
