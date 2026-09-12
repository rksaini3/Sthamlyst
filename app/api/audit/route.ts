import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lazy init: client sirf request ke andar banega, module load time pe nahi.
// Isse agar env var kabhi missing ho, to sirf us request pe 500 error aayega,
// pura Vercel build crash nahi hoga.
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase server env vars missing (check Vercel Environment Variables)');
  }
  return createClient(url, key);
}

// Ek hi OpenRouter endpoint se OpenAI aur Perplexity dono models call honge.
// Sirf OPENROUTER_API_KEY chahiye — alag-alag provider keys ki zaroorat nahi.
async function callOpenRouter(model: string, prompt: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY missing (check Vercel Environment Variables)');
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // OpenRouter ye headers optional recommend karta hai analytics/rate-limit ke liye
      'HTTP-Referer': 'https://sthamly.com',
      'X-Title': 'Sthamly AI Visibility Audit',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter (${model}) failed: ${errText}`);
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  // Perplexity (sonar) models OpenRouter response mein citations bhi dete hain
  const citations: string[] = data?.citations ?? [];
  return { text, citations };
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { websiteUrl, brandName, userId } = await req.json();

    if (!websiteUrl || !brandName) {
      return NextResponse.json(
        { error: 'websiteUrl and brandName are required' },
        { status: 400 }
      );
    }

    const { data: audit, error: insertErr } = await supabaseAdmin
      .from('audits')
      .insert({
        user_id: userId ?? null,
        website_url: websiteUrl,
        brand_name: brandName,
        status: 'running',
      })
      .select()
      .single();

    if (insertErr || !audit) {
      throw insertErr || new Error('Could not create audit row');
    }

    const openaiMention = await checkOpenAiMention(brandName, websiteUrl);
    const perplexityMention = await checkPerplexityMention(brandName, websiteUrl);
    const googleResult = await checkGoogleAiOverview(brandName);

    await supabaseAdmin.from('ai_mentions').insert([
      {
        audit_id: audit.id,
        source: 'openai',
        mentioned: openaiMention.mentioned,
        sentiment: openaiMention.sentiment,
        raw_response: openaiMention.raw,
      },
      {
        audit_id: audit.id,
        source: 'perplexity',
        mentioned: perplexityMention.mentioned,
        sentiment: perplexityMention.sentiment,
        citation_url: perplexityMention.citationUrl,
        raw_response: perplexityMention.raw,
      },
    ]);

    await supabaseAdmin.from('google_ai_overview_results').insert({
      audit_id: audit.id,
      query: `${brandName} reviews`,
      appears_in_overview: googleResult.appearsInOverview,
      ranked_position: googleResult.position,
      competitor_urls: googleResult.competitorUrls,
    });

    const score = computeVisibilityScore({
      openaiMentioned: openaiMention.mentioned,
      perplexityMentioned: perplexityMention.mentioned,
      inGoogleOverview: googleResult.appearsInOverview,
    });

    await supabaseAdmin
      .from('audits')
      .update({
        status: 'done',
        visibility_score: score,
        completed_at: new Date().toISOString(),
      })
      .eq('id', audit.id);

    return NextResponse.json({ auditId: audit.id, visibilityScore: score });
  } catch (err: any) {
    console.error('Audit error:', err);
    return NextResponse.json(
      { error: err.message || 'Audit failed' },
      { status: 500 }
    );
  }
}

async function checkOpenAiMention(brandName: string, websiteUrl: string) {
  const prompt = `Do you have any knowledge of a brand called "${brandName}" (website: ${websiteUrl})? Answer with YES or NO, then one sentence describing sentiment (positive/neutral/negative/unknown).`;

  const { text } = await callOpenRouter('openai/gpt-4o-mini', prompt);

  const mentioned = /\byes\b/i.test(text);
  let sentiment: 'positive' | 'neutral' | 'negative' | null = null;
  if (/positive/i.test(text)) sentiment = 'positive';
  else if (/negative/i.test(text)) sentiment = 'negative';
  else if (mentioned) sentiment = 'neutral';

  return { mentioned, sentiment, raw: text };
}

async function checkPerplexityMention(brandName: string, websiteUrl: string) {
  const prompt = `What do you find online about the brand "${brandName}" (${websiteUrl})? Cite your source URL if you have one.`;

  const { text, citations } = await callOpenRouter('perplexity/sonar', prompt);

  const mentioned = text.length > 0 && !/no information|not found/i.test(text);

  return {
    mentioned,
    sentiment: mentioned ? ('neutral' as const) : null,
    citationUrl: citations[0] ?? null,
    raw: text,
  };
}

async function checkGoogleAiOverview(brandName: string) {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: `${brandName} reviews` }),
  });

  const data = await res.json();
  const overview = data?.answerBox || data?.knowledgeGraph || null;
  const organicResults: any[] = data?.organic ?? [];

  const position = organicResults.findIndex((r) =>
    r.link?.toLowerCase().includes(brandName.toLowerCase())
  );

  return {
    appearsInOverview: Boolean(overview),
    position: position >= 0 ? position + 1 : null,
    competitorUrls: organicResults.slice(0, 3).map((r) => r.link),
  };
}

function computeVisibilityScore(input: {
  openaiMentioned: boolean;
  perplexityMentioned: boolean;
  inGoogleOverview: boolean;
}) {
  let score = 0;
  if (input.openaiMentioned) score += 35;
  if (input.perplexityMentioned) score += 35;
  if (input.inGoogleOverview) score += 30;
  return score;
}
