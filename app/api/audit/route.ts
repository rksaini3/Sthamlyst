import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
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
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Do you have any knowledge of a brand called "${brandName}" (website: ${websiteUrl})? Answer with YES or NO, then one sentence describing sentiment (positive/neutral/negative/unknown).`,
        },
      ],
      max_tokens: 100,
    }),
  });

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  const mentioned = /\byes\b/i.test(text);
  let sentiment: 'positive' | 'neutral' | 'negative' | null = null;
  if (/positive/i.test(text)) sentiment = 'positive';
  else if (/negative/i.test(text)) sentiment = 'negative';
  else if (mentioned) sentiment = 'neutral';

  return { mentioned, sentiment, raw: text };
}

async function checkPerplexityMention(brandName: string, websiteUrl: string) {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'user',
          content: `What do you find online about the brand "${brandName}" (${websiteUrl})? Cite your source URL if you have one.`,
        },
      ],
    }),
  });

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  const citations: string[] = data?.citations ?? [];
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