import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key);
}

async function askOpenRouter(model: string, prompt: string): Promise<string | null> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 150,
      }),
    });
    if (!res.ok) {
      console.error(`OpenRouter error for ${model}:`, res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return content ?? null;
  } catch (e) {
    console.error(`OpenRouter fetch failed for ${model}:`, e);
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
  { id: 'google/gemini-2.5-pro', source: 'gemini' as const },
  { id: 'openai/gpt-4o-mini', source: 'openai' as const },
];

const GENERAL_MODELS = [
  { id: 'openai/gpt-4o-mini', source: 'openai' as const },
  { id: 'perplexity/sonar', source: 'perplexity' as const },
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
  models: { id: string; source: string }[],
  promptBuilder: () => string,
  isLocal: boolean
) {
  const results = await Promise.all(
    models.map(async (m) => {
      const text = await askOpenRouter(m.id, promptBuilder());
      const parsed = parseMentionResponse(text);
      return { ...parsed, source: m.source, is_local: isLocal };
    })
  );

  const usable = results.filter((r) => r.mentioned !== null);
  const mentionCount = usable.filter((r) => r.mentioned === true).length;
  const score = usable.length > 0 ? Math.round((mentionCount / usable.length) * 100) : null;

  return { results, score };
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
    let websiteScore: number | null = null;

    if (hasWebsite) {
      const { results, score } = await runModelChecks(
        GENERAL_MODELS,
        () => buildGeneralPrompt(brandName),
        false
      );
      websiteResults = results;
      websiteScore = score;
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
            // India-context force karo — bina isके Google ka default
            // (US-locale) result set aata hai, jisme Indian brands ka
            // Knowledge Panel/Answer Box zyadatar khaali aata hai.
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

        // Ranked position bhi ab actually calculate karo — pehle hamesha
        // null hi bhej rahe the.
        const rankedIndex = organicResults.findIndex((r) =>
          r.link?.toLowerCase().includes(brandName.toLowerCase())
        );

        const { error: googleError } = await supabase.from('google_ai_overview_results').insert({
          audit_id: audit.id,
          query: brandName,
          appears_in_overview: appearsInOverview,
          ranked_position: rankedIndex >= 0 ? rankedIndex + 1 : null,
          competitor_urls: organicResults.slice(0, 3).map((r) => r.link),
        });
        if (googleError) {
          console.error('google_ai_overview_results insert failed:', googleError.message);
        }
      } catch (e) {
        console.error('Serper check failed:', e);
      }
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

    return NextResponse.json({ auditId: audit.id });
  } catch (err: any) {
    console.error('Audit failed:', err);
    return NextResponse.json({ error: err.message || 'Audit failed' }, { status: 500 });
  }
}
