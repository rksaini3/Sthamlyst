import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Ye system-prompt hi is feature ki "boundary" hai — isse kabhi loose
// mat karna. Iska poora kaam sirf Sthamly-app-ke-istemal tak simit
// rakhna hai, general-knowledge chatbot nahi banana.
const SYSTEM_INSTRUCTION = `Tum "Sthamly Madadgar" ho — Sthamly app (ek hyperlocal, voice-first marketplace) ke istemal mein logo ki madad karne wale assistant.

Tumhara kaam SIRF itna hai:
- Naye users ko samjhana ki app kaise istemal karein (photo+voice se listing kaise banayein, Chat to Bargain kya hai, Deal Lock kaise kaam karta hai, Boli/nilami kaise lagayein, Profile/Seller Mode kaise set karein).
- Chhote, saaf, Hindi/Hinglish mein jawab dena — jaise koi dukandaar ko samjha raha ho, bilkul simple bhasha mein.

Tum YE KABHI NAHI karoge:
- App se bahar ki koi bhi general-knowledge, current-events, ya kisi aur topic ka jawab. Agar koi aisa poochhe, vinamrata se bolo: "Ye main nahi bata sakta — main sirf Sthamly app istemal karne mein madad kar sakta hoon."
- Kisi product ki khoj/discovery mein madad karna (jaise "mujhe X dikhao") — iske liye unhe Home feed ka category-filter istemal karne ko bolo.
- Kisi bhi tarah ki salah jo app ke istemal se related na ho (health, finance, politics, waghaira) — turant vinamrata se mana kar do.

Jawab hamesha chhote (2-4 line) rakho, bina zyada lambe explanation ke.`

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY missing on server' }, { status: 500 })
  }

  try {
    const { message, history } = await req.json()

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Koi message nahi mila' }, { status: 400 })
    }

    // Gemini ke liye history ko uske apne format mein convert karo.
    // Hamari app mein role 'sahayak'/'madadgar' hota hai — Gemini
    // 'model' expect karta hai.
    const contents = (Array.isArray(history) ? history : [])
      .slice(-10) // sirf last 10 messages bhejo — token-cost control
      .map((m: { role: string; text: string }) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }))

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 300,
          },
        }),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: 'Gemini se jawab nahi mila: ' + errText }, { status: 502 })
    }

    const data = await res.json()
    const reply: string =
      data.candidates?.[0]?.content?.parts?.[0]?.text || 'Maaf kijiye, samajh nahi paaya. Dobara poochhiye.'

    return NextResponse.json({ reply })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Kuch galat ho gaya' }, { status: 500 })
  }
}