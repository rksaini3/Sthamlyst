import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-only route. GEMINI_API_KEY must be set in Vercel's Environment
// Variables (never NEXT_PUBLIC_ — that would ship it to the browser).
// Get a free key from https://aistudio.google.com/ (Gemini Flash models
// are free-tier, no credit card needed, but are rate-limited per
// minute/day — see the note returned in errors below).

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json()
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { reply: 'Sahayak abhi set up nahi hua hai — Vercel mein GEMINI_API_KEY environment variable missing hai.' },
        { status: 200 }
      )
    }

    // Ground the model in real Sthamly data instead of letting it
    // hallucinate products/prices — this RPC only ever returns a small,
    // safe read-only summary (see sthamly-schema-v13.sql).
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: grounding } = await supabase.rpc('sahayak_search', { p_query: message })

    const systemPrompt = `Tum "Sthamly Sahayak" ho — Sthamly app ka helpful assistant, jo Hindi-English mix ("Hinglish") mein baat karta hai, jaise ek madadgar local dost.

Sthamly Gonda, Uttar Pradesh ka ek hyperlocal platform hai: log local artisans ke 1-min reels dekhte hain, quiz khelke Sthamly Coins kamate hain, aur unhe local handmade products/services par discount ke roop mein Bazaar mein use kar sakte hain. Chat-to-Bargain se log seedhe seller se mol-bhav bhi kar sakte hain.

Neeche "GROUNDING_DATA" mein sirf isi sawaal ke liye Sthamly ke asli database se nikala gaya data hai (products, reels, creators). Sirf isi data ke baare mein baat karo — kabhi khud se koi product, price, ya creator naam mat banao. Agar GROUNDING_DATA khaali hai, saaf bata do ki kuch nahi mila aur Search page try karne ko bolo.

Jawab chota rakho — 2-3 sentences se zyada lamba mat karo, warna mobile screen par padhna mushkil ho jata hai.

GROUNDING_DATA: ${JSON.stringify(grounding)}`

    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Theek hai, main is data ke hisaab se hi jawab dunga.' }] },
      ...((history || []) as { role: string; text: string }[]).slice(-6).map((h) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ]

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      }
    )

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text()
      // Free-tier rate limits are common — surface a friendly message
      // instead of a raw error.
      if (geminiRes.status === 429) {
        return NextResponse.json({
          reply: 'Abhi thodi der ke liye bahut zyada log Sahayak use kar rahe hain (free-tier limit) — thodi der baad try karo.',
        })
      }
      console.error('Gemini API error:', errBody)
      return NextResponse.json({ reply: 'Sahayak abhi jawab nahi de paya, dobara try karo.' })
    }

    const geminiData = await geminiRes.json()
    const reply =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Maaf karo, samajh nahi paya. Dobara alag tarike se pucho.'

    return NextResponse.json({ reply, grounding })
  } catch (e: any) {
    console.error('Sahayak route error:', e)
    return NextResponse.json({ reply: 'Kuch gadbad ho gayi, dobara try karo.' }, { status: 200 })
  }
}
