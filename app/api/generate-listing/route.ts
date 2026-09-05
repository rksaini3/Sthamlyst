import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const CATEGORIES = [
  'Clay Crafts & Home Decor',
  'Flowers & Decor',
  'Clothing',
  'Painting & Art',
  'Antiques',
  'Food & Snacks',
  'Other',
]

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY missing on server' }, { status: 500 })
  }

  try {
    const incomingForm = await req.formData()
    const audioFile = incomingForm.get('audio') as File | null
    if (!audioFile) {
      return NextResponse.json({ error: 'Koi audio file nahi mili' }, { status: 400 })
    }

    // ---- Step 1: Whisper se transcribe karo ----
    const whisperForm = new FormData()
    whisperForm.append('file', audioFile, 'voice-note.webm')
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('language', 'hi')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    })

    if (!whisperRes.ok) {
      const errText = await whisperRes.text()
      return NextResponse.json({ error: 'Transcription fail: ' + errText }, { status: 502 })
    }

    const whisperData = await whisperRes.json()
    const transcript: string = whisperData.text || ''

    if (!transcript.trim()) {
      return NextResponse.json({ error: 'Kuch sunayi nahi diya, dobara try karein.' }, { status: 422 })
    }

    // ---- Step 2: GPT se structured fields nikaalo ----
    const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Tum ek hyperlocal marketplace ke liye listing-banane wale assistant ho. ' +
              'User ne Hindi/mixed-language mein apne saamaan ke baare mein bola hai. ' +
              'Uska transcript padhkar ek chhoti, saaf listing banao. ' +
              `Category sirf inme se choose karo: ${CATEGORIES.join(', ')}. ` +
              'Agar daam bola gaya ho to number nikaalo, warna null do. ' +
              'Sirf is JSON shape mein jawab do: {"title": string, "description": string, "category": string, "price": number|null}. ' +
              'Title chhota (max 8 shabd), description 1-2 line mein.',
          },
          { role: 'user', content: transcript },
        ],
        temperature: 0.3,
      }),
    })

    if (!chatRes.ok) {
      const errText = await chatRes.text()
      return NextResponse.json({ error: 'Field extraction fail: ' + errText }, { status: 502 })
    }

    const chatData = await chatRes.json()
    const rawContent = chatData.choices?.[0]?.message?.content || '{}'
    let parsed: { title?: string; description?: string; category?: string; price?: number | null }
    try {
      parsed = JSON.parse(rawContent)
    } catch {
      parsed = {}
    }

    return NextResponse.json({
      transcript,
      title: parsed.title || '',
      description: parsed.description || '',
      category: CATEGORIES.includes(parsed.category || '') ? parsed.category : CATEGORIES[0],
      price: typeof parsed.price === 'number' ? parsed.price : null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Kuch galat ho gaya' }, { status: 500 })
  }
}
