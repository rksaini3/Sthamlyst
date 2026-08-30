# Sthamly — Learn & Ear

Next.js 14 + Tailwind + Supabase. Pilot: Gonda, UP. Theme: Clay Crafts & Home Decor.

## 1. Local setup

```bash
npm install
cp .env.local.example .env.local
# Fill .env.local with your Supabase URL + anon key
npm run dev
```

Open http://localhost:3000

## 2. Supabase

Run `sthamly-learn-earn-schema.sql` (provided separately) in
Supabase Dashboard → SQL Editor → New Query → Run.

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Sthamly MVP"
git branch -M main
git remote add origin https://github.com/<your-username>/sthamly.git
git push -u origin main
```

## 4. Deploy to Vercel (free)

1. Go to vercel.com → Sign in with GitHub
2. **Add New → Project** → select your `sthamly` repo → **Import**
3. Add Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy** — live in ~1-2 minutes at `sthamly.vercel.app`
