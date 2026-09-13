import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key);
}

const CACHE_FRESHNESS_HOURS = 24;

async function askOpenRouter(models: string[], prompt: string): Promise<string | null> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        models,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 150,
      }),
    });
    if (!res.ok) {
      console.error(`OpenRouter error for ${models.join(',')}:`, res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return content ?? null;
  } catch (e) {
    console.error(`OpenRouter fetch failed for ${models.join(',')}:`, e);
    return null;
  }
}

function parseMentionResponse(text: string | null) {
  if (!text) {
    return { mentioned: null, sentiment: 'neutral' as const, citation_url: null, raw: null };
  }

  const strictMatch = text.match(/MENTIONED:\s*(yes|no)/i);
  let mentioned: boolean | null = null;

  if (strictMatch) {
    mentioned = strictMatch[1].toLowerCase() === 'yes';
  } else {
    const yesIndex = text.search(/\byes\b/i);
    const noIndex = text.search(/\bno\b/i);
    if (yesIndex === -1 && noIndex === -1) {
      mentioned = null;
    } else if (yesIndex === -1) {
      mentioned = false;
    } else if (noIndex === -1) {
      mentioned = true;
    } else {
      mentioned = yesIndex < noIndex;
    }
  }

  const sentimentMatch = text.match(/SENTIMENT:\s*(positive|neutral|negative)/i);
  const sentiment = (sentimentMatch ? sentimentMatch[1].toLowerCase() : 'neutral') as
    | 'positive'
    | 'neutral'
    | 'negative';

  const citationMatch = text.match(/CITATION_URL:\s*(\S+)/i);
  const citation = citationMatch && citationMatch[1].toLowerCase() !== 'none' ? citationMatch[1] : null;

  return { mentioned, sentiment, citation_url: citation, raw: text };
}

const LOCAL_MODELS = [
  { models: ['google/gemini-2.5-flash', 'google/gemini-2.5-pro'], source: 'gemini' as const },
  { models: ['openai/gpt-4o-mini'], source: 'openai' as const },
];

const GENERAL_MODELS = [
  { models: ['openai/gpt-4o-mini'], source: 'openai' as const },
  { models: ['perplexity/sonar'], source: 'perplexity' as const },
];

function buildLocalPrompt(brandName: string, city: string) {
  return `Answer strictly in this exact format, nothing else, no extra commentary:
MENTIONED: yes or no
SENTIMENT: positive, neutral, or negative

Question: If someone in ${city} searched for a local business like "${brandName}" or a relevant service category near them, is "${brandName}" a business/brand you have specific knowledge of?`;
}

function buildGeneralPrompt(brandName: string) {
  return `Answer strictly in this exact format, nothing else, no extra commentary:
MENTIONED: yes or no
SENTIMENT: positive, neutral, or negative
CITATION_URL: a specific url if you know one, otherwise write none

Question: Do you have specific knowledge of a brand/company called "${brandName}"?`;
}

async function runModelChecks(
  models: { models: string[]; source: string }[],
  promptBuilder: () => string,
  isLocal: boolean
) {
  const results = await Promise.all(
    models.map(async (m) => {
      const text = await askOpenRouter(m.models, promptBuilder());
      const parsed = parseMentionResponse(text);
      return { ...parsed, source: m.source, is_local: isLocal };
    })
  );

  const usable = results.filter((r) => r.mentioned !== null);
  const mentionCount = usable.filter((r) => r.mentioned === true).length;
  const score = usable.length > 0 ? Math.round((mentionCount / usable.length) * 100) : null;

  return { results, score };
}

function computeGoogleScore(appearsInOverview: boolean, rankedPosition: number | null) {
  if (appearsInOverview) return 100;
  if (rankedPosition !== null) {
    return rankedPosition <= 3 ? 60 : 30;
  }
  return 0;
}

export async function POST(req: NextRequest) {
  try {
    const { brandName, city, websiteUrl, userId } = await req.json();
    if (!brandName || !city) {
      return NextResponse.json({ error: 'brandName and city are required' }, { status: 400 });
    }
    const hasWebsite = !!websiteUrl && websiteUrl.trim().length > 0;
    const supabase = getSupabaseAdmin();

    let cacheQuery = supabase
      .from('audits')
      .select('id, created_at')
      .ilike('brand_name', brandName.trim())
      .eq('target_city', city.trim())
      .eq('has_website', hasWebsite)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1);

    cacheQuery = hasWebsite
      ? cacheQuery.eq('website_url', websiteUrl)
      : cacheQuery.is('website_url', null);

    const { data: cachedAudit } = await cacheQuery.maybeSingle();

    if (cachedAudit) {
      const ageMs = Date.now() - new Date(cachedAudit.created_at).getTime();
      if (ageMs < CACHE_FRESHNESS_HOURS * 60 * 60 * 1000) {
        return NextResponse.json({ auditId: cachedAudit.id, cached: true });
      }
    }

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
      console.error('audits insert failed:', insertError?.message);
      return NextResponse.json(
        { error: insertError?.message || 'Could not create audit' },
        { status: 500 }
      );
    }

    const { results: localResults, score: localScore } = await runModelChecks(
      LOCAL_MODELS,
      () => buildLocalPrompt(brandName, city),
      true
    );

    let websiteResults: any[] = [];
    let aiWebsiteScore: number | null = null;
    let googleScore: number | null = null;

    if (hasWebsite) {
      const { results, score } = await runModelChecks(
        GENERAL_MODELS,
        () => buildGeneralPrompt(brandName),
        false
      );
      websiteResults = results;
      aiWebsiteScore = score;
    }

    const allResults = [...localResults, ...websiteResults];
    if (allResults.length > 0) {
      const { error: mentionsError } = await supabase.from('ai_mentions').insert(
        allResults.map((r) => ({
          audit_id: audit.id,
          source: r.source,
          mentioned: r.mentioned,
          sentiment: r.sentiment,
          citation_url: r.citation_url,
          is_local: r.is_local,
          raw_response: r.raw,
        }))
      );
      if (mentionsError) {
        console.error('ai_mentions insert failed:', mentionsError.message);
      }
    }

    if (hasWebsite && process.env.SERPER_API_KEY) {
      try {
        const serperRes = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': process.env.SERPER_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: brandName,
            gl: 'in',
            hl: 'en',
          }),
        });
        const serperData = await serperRes.json();
        const overviewText = JSON.stringify(
          serperData.answerBox || serperData.knowledgeGraph || {}
        );
        const appearsInOverview = overviewText.toLowerCase().includes(brandName.toLowerCase());
        const organicResults: any[] = serperData.organic ?? [];

        const rankedIndex = organicResults.findIndex((r) =>
          r.link?.toLowerCase().includes(brandName.toLowerCase())
        );
        const rankedPosition = rankedIndex >= 0 ? rankedIndex + 1 : null;

        googleScore = computeGoogleScore(appearsInOverview, rankedPosition);

        const { error: googleError } = await supabase.from('google_ai_overview_results').insert({
          audit_id: audit.id,
          query: brandName,
          appears_in_overview: appearsInOverview,
          ranked_position: rankedPosition,
          competitor_urls: organicResults.slice(0, 3).map((r) => r.link),
        });
        if (googleError) {
          console.error('google_ai_overview_results insert failed:', googleError.message);
        }
      } catch (e) {
        console.error('Serper check failed:', e);
      }
    }

    let websiteScore: number | null = null;
    if (aiWebsiteScore !== null && googleScore !== null) {
      websiteScore = Math.round(aiWebsiteScore * 0.7 + googleScore * 0.3);
    } else if (aiWebsiteScore !== null) {
      websiteScore = aiWebsiteScore;
    } else if (googleScore !== null) {
      websiteScore = googleScore;
    }

    await supabase
      .from('audits')
      .update({
        status: 'complete',
        visibility_score: websiteScore,
        local_visibility_score: localScore,
        completed_at: new Date().toISOString(),
      })
      .eq('id', audit.id);

    return NextResponse.json({ auditId: audit.id, cached: false });
  } catch (err: any) {
    console.error('Audit failed:', err);
    return NextResponse.json({ error: err.message || 'Audit failed' }, { status: 500 });
  }
}