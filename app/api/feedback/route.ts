import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { message, userEmail, page } = await req.json();

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error('Telegram env vars missing — feedback console mein log ho raha hai:', {
        message,
        userEmail,
        page,
      });
      return NextResponse.json({ success: true }); // user ko fail mat dikhao, silently log karo
    }

    const text = `📩 *Naya Feedback — Sthamly*\n\n👤 ${userEmail}\n📄 ${page}\n\n💬 ${message}`;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('feedback route error:', err);
    return NextResponse.json({ success: true }); // feedback fail hone se user experience na bigade
  }
}
