import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key);
}

async function askOpenRouter(model: string, prompt: string) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

function parseMentionResponse(text: string) {
  const mentioned = /MENTIONED:\s*yes/i.test(text);
  const sentimentMatch = text.match(/SENTIMENT:\s*(positive|neutral|negative)/i);
  const sentiment = sentimentMatch ? sentimentMatch[1].toLowerCase() : 'neutral';
  const citationMatch = text.match(/CITATION_URL:\s*(\S+)/i);
  return {
    mentioned,
    sentiment,
    citation_url: citationMatch ? citationMatch[1] : null,
  };
}

const LOCAL_MODELS = [
  { id: 'google/gemini-2.5-pro', source: 'gemini' },
  { id: 'openai/gpt-4o-mini', source: 'openai' },
];

const GENERAL_MODELS = [
  { id: 'openai/gpt-4o-mini', source: 'openai' },
  { id: 'perplexity/sonar', source: 'perplexity' },
];

function buildLocalPrompt(brandName: string, city: string) {
  return `You are simulating a local search assistant. If someone in ${city} searched for a business like "${brandName}" or a relevant local service category near them, would "${brandName}" specifically be known or mentioned? Reply in this exact format:
MENTIONED: yes/no
SENTIMENT: positive/neutral/negative
Reason: one line`;
}

function buildGeneralPrompt(brandName: string) {
  return `Do you know of a brand/company called "${brandName}"? If someone asked about companies or services in its space, would you mention "${brandName}"? Reply in this exact format:
MENTIONED: yes/no
SENTIMENT: positive/neutral/negative
CITATION_URL: url if you have a specific source, else none
Reason: one line`;
}

export async function POST(req: NextRequest) {
  try {
    const { brandName, city, websiteUrl, userId } = await req.json();
    if (!brandName || !city) {
      return NextResponse.json({ error: 'brandName and city are required' }, { status: 400 });
    }
    const hasWebsite = !!websiteUrl && websiteUrl.trim().length > 0;
    const supabase = getSupabaseAdmin();

    const { data: audit, error: insertError } = await supabase
      .from('audits')
      .insert({
        user_id: userId || null,
        brand_name: brandName,
        website_url: hasWebsite ? websiteUrl : null,
        target_city: city,
        has_website: hasWebsite,
        status: 'processing',
      })
      .select()
      .single();

    if (insertError || !audit) {
      return NextResponse.json({ error: insertError?.message || 'Could not create audit' }, { status: 500 });
    }

    // 1. Local visibility check — always runs
    const localResults = await Promise.all(
      LOCAL_MODELS.map(async (m) => {
        const text = await askOpenRouter(m.id, buildLocalPrompt(brandName, city));
        return { ...parseMentionResponse(text), source: m.source, is_local: true };
      })
    );

    const localMentionCount = localResults.filter((r) => r.mentioned).length;
    const localScore = Math.round((localMentionCount / localResults.length) * 100);

    // 2. General/website visibility check — only if website provided
    let generalResults: any[] = [];
    let websiteScore: number | null = null;

    if (hasWebsite) {
      generalResults = await Promise.all(
        GENERAL_MODELS.map(async (m) => {
          const text = await askOpenRouter(m.id, buildGeneralPrompt(brandName));
          return { ...parseMentionResponse(text), source: m.source, is_local: false };
        })
      );
      const generalMentionCount = generalResults.filter((r) => r.mentioned).length;
      websiteScore = Math.round((generalMentionCount / generalResults.length) * 100);
    }

    const allMentions = [...localResults, ...generalResults];
    if (allMentions.length > 0) {
      await supabase.from('ai_mentions').insert(
        allMentions.map((r) => ({
          audit_id: audit.id,
          source: r.source,
          mentioned: r.mentioned,
          sentiment: r.sentiment,
          citation_url: r.citation_url,
          is_local: r.is_local,
        }))
      );
    }

    // 3. Google AI Overview check — only if website provided
    if (hasWebsite && process.env.SERPER_API_KEY) {
      try {
        const serperRes = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': process.env.SERPER_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ q: brandName }),
        });
        const serperData = await serperRes.json();
        const overviewText = JSON.stringify(serperData.answerBox || serperData.knowledgeGraph || {});
        const appearsInOverview = overviewText.toLowerCase().includes(brandName.toLowerCase());

        await supabase.from('google_ai_overview_results').insert({
          audit_id: audit.id,
          query: brandName,
          appears_in_overview: appearsInOverview,
          ranked_position: null,
          competitor_urls: [],
        });
      } catch (e) {
        // Serper fail hone par bhi audit block nahi hona chahiye
      }
    }

    await supabase
      .from('audits')
      .update({
        status: 'complete',
        visibility_score: websiteScore,
        local_visibility_score: localScore,
      })
      .eq('id', audit.id);

    return NextResponse.json({ auditId: audit.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Audit failed' }, { status: 500 });
  }
}