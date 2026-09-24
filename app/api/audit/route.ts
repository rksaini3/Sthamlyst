import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key);
}

const CACHE_FRESHNESS_HOURS = 24;
const RATE_LIMIT_MAX_REQUESTS = 5; // ek IP se 1 ghante mein max 5 naye audits
const RATE_LIMIT_WINDOW_HOURS = 1;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

async function checkRateLimit(supabase: any, ip: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('audit_rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .gte('created_at', windowStart);

  if (error) {
    console.error('Rate limit check failed:', error.message);
    return true; // check fail ho to block mat karo, request chalne do
  }
  return (count ?? 0) < RATE_LIMIT_MAX_REQUESTS;
}

async function recordRateLimitHit(supabase: any, ip: string) {
  await supabase.from('audit_rate_limits').insert({ ip_address: ip });
}

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
  { models: ['anthropic/claude-3.5-haiku'], source: 'anthropic' as const },
];

function buildLocalPrompt(brandName: string, city: string) {
  return `Answer strictly in this exact format, nothing else, no extra commentary:
MENTIONED: yes or no
SENTIMENT: positive, neutral, or negative
REASON: one short sentence explaining your answer

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
    const { brandName, city, websiteUrl, userId, force } = await req.json();
    if (!brandName || !city) {
      return NextResponse.json({ error: 'brandName and city are required' }, { status: 400 });
    }
    const hasWebsite = !!websiteUrl && websiteUrl.trim().length > 0;
    const supabase = getSupabaseAdmin();
    const clientIp = getClientIp(req);

    // --- CACHE CHECK (rate-limit se pehle — cached response free hai, block karne ki zaroorat nahi) ---
    let cacheQuery = supabase
      .from('audits')
      .select('id, created_at')
      .ilike('brand_name', brandName.trim().replace(/[\\%_]/g, (c: string) => '\\' + c))
      .eq('target_city', city.trim())
      .eq('has_website', hasWebsite)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1);

    cacheQuery = hasWebsite
      ? cacheQuery.eq('website_url', websiteUrl)
      : cacheQuery.is('website_url', null);

    const { data: cachedAudit } = await cacheQuery.maybeSingle();

    // force=true: fix ke baad fresh re-audit chahiye (Before/After report ke liye) — cache skip
    if (cachedAudit && !force) {
      const ageMs = Date.now() - new Date(cachedAudit.created_at).getTime();
      if (ageMs < CACHE_FRESHNESS_HOURS * 60 * 60 * 1000) {
        return NextResponse.json({ auditId: cachedAudit.id, cached: true });
      }
    }

    // --- RATE LIMIT CHECK (sirf naye/non-cached audits ke liye, jinme real API cost lagti hai) ---
    const allowed = await checkRateLimit(supabase, clientIp);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Bahut zyada audits ho gaye is IP se. Kripya 1 ghante baad try karein.' },
        { status: 429 }
      );
    }
    await recordRateLimitHit(supabase, clientIp);

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

    // --- YEH TEEN CHECKS EK-DUSRE PAR DEPEND NAHI KARTE, isliye ab PARALLEL
    // chalte hain (Promise.all) instead of ek-ek karke. Pehle local models ka
    // wait, phir website models ka wait, phir Serper ka wait hota tha — total
    // time teeno ka jod (~8-12s). Ab sabse slow wale jitna hi lagta hai (~4-5s).
    async function runGoogleCheck(): Promise<{
      appearsInOverview: boolean;
      rankedPosition: number | null;
      organicUrls: string[];
      googleScore: number;
    } | null> {
      if (!(hasWebsite && process.env.SERPER_API_KEY)) return null;
      try {
        const serperRes = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': process.env.SERPER_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ q: brandName, gl: 'in', hl: 'en' }),
        });
        const serperData = await serperRes.json();
        const overviewText = JSON.stringify(serperData.answerBox || serperData.knowledgeGraph || {});
        const appearsInOverview = overviewText.toLowerCase().includes(brandName.toLowerCase());
        const organicResults: any[] = serperData.organic ?? [];

        const brandSlug = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
        let siteHost: string | null = null;
        try {
          siteHost = websiteUrl ? new URL(websiteUrl).hostname.replace(/^www\./, '').toLowerCase() : null;
        } catch {
          siteHost = null;
        }
        const rankedIndex = organicResults.findIndex((r) => {
          const link = String(r.link ?? '').toLowerCase();
          if (!link) return false;
          if (siteHost && link.includes(siteHost)) return true;
          return brandSlug.length > 0 && link.replace(/[^a-z0-9]/g, '').includes(brandSlug);
        });
        const rankedPosition = rankedIndex >= 0 ? rankedIndex + 1 : null;

        return {
          appearsInOverview,
          rankedPosition,
          organicUrls: organicResults.slice(0, 3).map((r) => r.link),
          googleScore: computeGoogleScore(appearsInOverview, rankedPosition),
        };
      } catch (e) {
        console.error('Serper check failed:', e);
        return null;
      }
    }

    const [
      { results: localResults, score: localScore },
      websiteCheck,
      google,
    ] = await Promise.all([
      runModelChecks(LOCAL_MODELS, () => buildLocalPrompt(brandName, city), true),
      hasWebsite
        ? runModelChecks(GENERAL_MODELS, () => buildGeneralPrompt(brandName), false)
        : Promise.resolve({ results: [] as any[], score: null as number | null }),
      runGoogleCheck(),
    ]);

    const websiteResults = websiteCheck.results;
    const aiWebsiteScore = websiteCheck.score;
    const googleScore = google?.googleScore ?? null;

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

    if (google) {
      const { error: googleError } = await supabase.from('google_ai_overview_results').insert({
        audit_id: audit.id,
        query: brandName,
        appears_in_overview: google.appearsInOverview,
        ranked_position: google.rankedPosition,
        competitor_urls: google.organicUrls,
      });
      if (googleError) {
        console.error('google_ai_overview_results insert failed:', googleError.message);
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
}```

---

## 6. REPLACE → `app/dashboard/page.tsx`

```tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AuditGraph from '@/components/AuditGraph';
import FixButton from '@/components/FixButton';
import GapReportButton from '@/components/GapReportButton';
import BeforeAfterReportButton from '@/components/BeforeAfterReportButton';
import Link from 'next/link';
import { useIntroPrice } from '@/lib/useIntroPrice';
import { CheckCircle2, XCircle, AlertTriangle, MapPin, Globe, Zap } from 'lucide-react';
import type { AuditReport } from '@/types';

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <DashboardContent />
    </Suspense>
  );
}

function mentionBadge(mentioned: boolean | null) {
  if (mentioned === true) {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        <CheckCircle2 size={13} /> Mentioned
      </span>
    );
  }
  if (mentioned === false) {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
        <XCircle size={13} /> Not mentioned
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
      <AlertTriangle size={13} /> Could not check
    </span>
  );
}

function getDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => '\\' + c);
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const auditId = searchParams.get('audit');

  const [report, setReport] = useState<AuditReport | null>(null);
  const [optimizationId, setOptimizationId] = useState<string | null>(null);
  const [matchedSite, setMatchedSite] = useState<string | null>(null);
  const [isFirstAudit, setIsFirstAudit] = useState(false);
  const [fixApplied, setFixApplied] = useState(false);
  const [hasSite, setHasSite] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [agencyName, setAgencyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'maps' | 'website'>('maps');
  const { amountLabel: mapsFixPrice } = useIntroPrice();

  // Agency ka naam (PDF par "prepared by" ke roop mein) — is browser mein yaad rakhta hai
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('sthamly_agency_name');
      if (saved) setAgencyName(saved);
    } catch {
      /* localStorage available nahi to koi baat nahi */
    }
  }, []);

  function updateAgencyName(value: string) {
    setAgencyName(value);
    try {
      window.localStorage.setItem('sthamly_agency_name', value);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!auditId) {
      router.push('/');
      return;
    }
    loadReport(auditId);
  }, [auditId]);

  async function loadReport(id: string) {
    setLoading(true);

    // --- ROUND 1: yeh 4 queries ek-dusre par depend nahi karti, saath chalao ---
    const [{ data: audit, error: auditErr }, { data: mentions }, { data: googleResults }, { data: userData }] =
      await Promise.all([
        supabase.from('audits').select('*').eq('id', id).single(),
        supabase.from('ai_mentions').select('*').eq('audit_id', id),
        supabase.from('google_ai_overview_results').select('*').eq('audit_id', id),
        supabase.auth.getUser(),
      ]);

    if (auditErr || !audit) {
      setError('Audit not found');
      setLoading(false);
      return;
    }

    const uid = userData.user?.id ?? null;
    setLoggedIn(!!uid);

    // --- ROUND 2: sameBrand list — audit ka data chahiye, isliye Round 1 ke baad ---
    let sameBrandQ = supabase
      .from('audits')
      .select('id, created_at')
      .ilike('brand_name', escapeLike(audit.brand_name))
      .eq('target_city', audit.target_city)
      .eq('status', 'complete');
    sameBrandQ = audit.website_url
      ? sameBrandQ.eq('website_url', audit.website_url)
      : sameBrandQ.is('website_url', null);

    // wpConns ko bhi isi round mein chala dete hain — yeh sirf `uid` par depend karta hai,
    // sameBrand ke result ka wait karne ki zaroorat nahi
    const [{ data: sameBrand }, wpConnsResult] = await Promise.all([
      sameBrandQ,
      uid && audit.has_website
        ? supabase.from('wordpress_connections').select('id, site_url').eq('user_id', uid)
        : Promise.resolve({ data: null }),
    ]);

    const sameBrandList = sameBrand ?? [];
    const earlier = sameBrandList.filter(
      (a) => new Date(a.created_at).getTime() < new Date(audit.created_at).getTime()
    );
    setIsFirstAudit(earlier.length === 0);

    // --- ROUND 3: appliedRows sameBrandList ke ids par depend karta hai ---
    let brandFixed = false;
    if (sameBrandList.length > 0) {
      const { data: appliedRows } = await supabase
        .from('optimizations')
        .select('id')
        .in('audit_id', sameBrandList.map((a) => a.id))
        .eq('status', 'applied')
        .eq('payment_status', 'paid')
        .limit(1);
      brandFixed = !!appliedRows && appliedRows.length > 0;
    }
    setFixApplied(brandFixed);

    if (audit.has_website && !brandFixed && uid) {
      const wpConns = wpConnsResult.data;
      const auditDomain = getDomain(audit.website_url);
      const chosenWp =
        (wpConns ?? []).find((c) => getDomain(c.site_url) === auditDomain) ?? (wpConns ?? [])[0] ?? null;

      const wpId: string | null = chosenWp?.id ?? null;
      setHasSite(!!wpId);
      setMatchedSite(chosenWp?.site_url ?? null);

      // Har page-load par naya optimization row nahi banate — pehle wala reuse karte hain
      const { data: existingOpt } = await supabase
        .from('optimizations')
        .select('id, payment_status, wordpress_connection_id')
        .eq('audit_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let optId: string | null = existingOpt?.id ?? null;

      if (!existingOpt) {
        const { data: created } = await supabase
          .from('optimizations')
          .insert({
            audit_id: id,
            wordpress_connection_id: wpId,
            fix_type: 'schema_markup',
            status: 'pending',
            payment_status: 'unpaid',
          })
          .select()
          .single();
        optId = created?.id ?? null;
      } else if (existingOpt.payment_status !== 'paid' && existingOpt.wordpress_connection_id !== wpId) {
        // Ho sakta hai user ne baad mein site connect ki ho — pending optimization ko update karo
        await supabase.from('optimizations').update({ wordpress_connection_id: wpId }).eq('id', existingOpt.id);
      }

      setOptimizationId(optId);
    }

    setReport({
      ...audit,
      ai_mentions: mentions ?? [],
      google_results: googleResults ?? [],
    });
    setLoading(false);
  }

  if (loading) return <main className="p-6 dark:bg-[#0B0C1A] dark:text-stone-100 min-h-screen">Loading your report…</main>;
  if (error || !report) return <main className="p-6 dark:bg-[#0B0C1A] dark:text-stone-100 min-h-screen">{error}</main>;

  const auditAgeDays = Math.floor((Date.now() - new Date(report.created_at).getTime()) / (24 * 60 * 60 * 1000));
  const localMentions = report.ai_mentions.filter((m) => m.is_local);
  const websiteMentions = report.ai_mentions.filter((m) => !m.is_local);

  return (
    <main className="min-h-screen px-6 py-10 max-w-2xl mx-auto pb-24 bg-white dark:bg-[#0B0C1A] text-stone-900 dark:text-stone-100">
      <h1 className="text-2xl font-bold mb-1">{report.brand_name}</h1>
      <p className="text-gray-500 dark:text-stone-400 mb-6">{report.target_city}</p>

      <div className="mb-3">
        <label className="block text-xs text-gray-500 dark:text-stone-400 mb-1">
          Agency / company ka naam (PDF par &quot;prepared by&quot; mein dikhega, optional)
        </label>
        <input
          type="text"
          value={agencyName}
          maxLength={60}
          onChange={(e) => updateAgencyName(e.target.value)}
          placeholder="Jaise: BrightEdge Marketing"
          className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <GapReportButton
        auditId={report.id}
        brandName={report.brand_name}
        isFirstAudit={isFirstAudit}
        agencyName={agencyName}
      />

      {auditAgeDays >= 30 && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-sm text-amber-900 dark:text-amber-200">
          Ye audit {auditAgeDays} din purana hai. AI assistants ke jawab samay ke saath badalte rehte hain, isliye naya
          score dekhne ke liye dobara audit chalayein. Har mahine automatic monitoring chahiye to Pro plan dekhein.
        </div>
      )}

      {report.has_website && (
        <div className="flex border-b border-stone-200 dark:border-stone-800 mb-6">
          <button
            onClick={() => setActiveTab('maps')}
            className={`flex-1 py-2 text-sm font-semibold ${
              activeTab === 'maps' ? 'border-b-2 border-[#8B85E3] text-[#8B85E3]' : 'text-gray-500 dark:text-stone-400'
            }`}
          >
            <span className="inline-flex items-center gap-1.5"><MapPin size={15} /> Maps Visibility</span>
          </button>
          <button
            onClick={() => setActiveTab('website')}
            className={`flex-1 py-2 text-sm font-semibold ${
              activeTab === 'website' ? 'border-b-2 border-[#8B85E3] text-[#8B85E3]' : 'text-gray-500 dark:text-stone-400'
            }`}
          >
            <span className="inline-flex items-center gap-1.5"><Globe size={15} /> Website AI Score</span>
          </button>
        </div>
      )}

      {(!report.has_website || activeTab === 'maps') && (
        <section>
          <AuditGraph score={report.local_visibility_score ?? -1} />
          <p className="text-center text-gray-600 dark:text-stone-400 mt-3 mb-6">Local AI & Maps Pack Score</p>

          <h3 className="font-semibold mb-2">AI Mentions</h3>
          <div className="space-y-3 mb-6">
            {localMentions.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-stone-500">No AI mention data available for this audit.</p>
            )}
            {localMentions.map((m) => (
              <div key={m.id} className="border border-stone-200 dark:border-stone-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium capitalize">{m.source}</p>
                  {mentionBadge(m.mentioned)}
                </div>
                <p className="text-sm text-gray-600 dark:text-stone-400 capitalize">Sentiment: {m.sentiment ?? '—'}</p>
              </div>
            ))}
          </div>

          {/*
            NOTE: Yeh button abhi jaan-bujhkar disabled hai — Google Business Profile
            API access abhi Google approval ke pending hai. Jab tak actual GBP push
            backend na bane, ismein clickable/payable banana galat hai (paisa lekar
            bina delivery kiye chhodna). Approval milte hi isko FixButton jaisa live
            kar dena — fix_type: 'gbp_listing' wala naya optimization record banake.
          */}
          <button
            disabled
            title="Google Business Profile API approval pending — jald hi live hoga"
            className="w-full bg-stone-300 dark:bg-stone-700 text-stone-500 dark:text-stone-400 rounded-lg py-3 font-semibold cursor-not-allowed"
          >
            <span className="inline-flex items-center gap-2"><Zap size={16} /> Auto-Fix Google Maps Listing — {mapsFixPrice} (जल्द आ रहा है)</span>
          </button>
        </section>
      )}

      {report.has_website && activeTab === 'website' && (
        <section>
          <AuditGraph score={report.visibility_score ?? -1} />
          <p className="text-center text-gray-600 dark:text-stone-400 mt-3 mb-6">Website AI Visibility Score</p>

          <h3 className="font-semibold mb-2">AI Mentions & Citations</h3>
          <div className="space-y-3 mb-6">
            {websiteMentions.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-stone-500">No AI mention data available for this audit.</p>
            )}
            {websiteMentions.map((m) => (
              <div key={m.id} className="border border-stone-200 dark:border-stone-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium capitalize">{m.source}</p>
                  {mentionBadge(m.mentioned)}
                </div>
                <p className="text-sm text-gray-600 dark:text-stone-400 capitalize mb-2">Sentiment: {m.sentiment ?? '—'}</p>

                <p className="text-xs text-gray-400 dark:text-stone-500 mb-1">Citation:</p>
                {m.citation_url ? (
                  <a
                    href={m.citation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#8B85E3] underline break-all"
                  >
                    {m.citation_url}
                  </a>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-stone-500">
                    {m.mentioned === true ? 'No specific source link returned by this model' : '—'}
                  </p>
                )}
              </div>
            ))}
          </div>

          <section className="mb-6 space-y-2">
            <h2 className="font-semibold text-lg">Google Search Presence</h2>
            <p className="text-xs text-gray-400 dark:text-stone-500 mb-1">
              Google Knowledge Panel / Answer Box में presence — Google का नया "AI Overview" फीचर अभी इस चेक में शामिल नहीं है। (Website score mein 30% weight ke saath already shaamil hai.)
            </p>
            {report.google_results.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-stone-500">No search presence data available.</p>
            )}
            {report.google_results.map((g) => (
              <div key={g.id} className="border border-stone-200 dark:border-stone-800 rounded-lg p-4 space-y-1">
                <p className="text-sm text-gray-600 dark:text-stone-400">
                  Query: <span className="font-medium">{g.query}</span>
                </p>
                <p className="text-sm text-gray-600 dark:text-stone-400">
                  Knowledge Panel:{' '}
                  <span className="inline-flex items-center gap-1 align-middle">
                    {g.appears_in_overview ? (
                      <><CheckCircle2 size={14} className="text-green-600" /> Appears</>
                    ) : (
                      <><XCircle size={14} className="text-red-500" /> Not shown for this query</>
                    )}
                  </span>
                </p>
                {g.ranked_position && (
                  <p className="text-sm text-gray-600 dark:text-stone-400">
                    Organic Search Rank: <span className="font-medium">#{g.ranked_position}</span>{' '}
                    (aapki website search results mein kitne number par hai)
                  </p>
                )}
                {g.competitor_urls && g.competitor_urls.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-400 dark:text-stone-500 mb-1">Top organic results:</p>
                    {g.competitor_urls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#8B85E3] underline break-all block"
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>

          <section>
            <h2 className="font-semibold text-lg mb-2">Fix Issues Automatically</h2>
            {fixApplied ? (
              <div className="space-y-3">
                <p className="text-sm text-green-700 dark:text-green-400">
                  Is brand par fix apply ho chuka hai. Ab Before/After report download kar sakte hain.
                </p>
                <BeforeAfterReportButton
                  currentAuditId={report.id}
                  brandName={report.brand_name}
                  city={report.target_city}
                  websiteUrl={report.website_url}
                  agencyName={agencyName}
                />
              </div>
            ) : optimizationId && hasSite ? (
              <>
                {matchedSite && (
                  <p className="text-xs text-gray-500 dark:text-stone-400 mb-2">
                    Ye fix <span className="font-medium">{matchedSite}</span> par apply hoga
                  </p>
                )}
                <FixButton
                  auditId={report.id}
                  optimizationId={optimizationId}
                  onApplied={() => setFixApplied(true)}
                />
              </>
            ) : !loggedIn ? (
              <p className="text-sm text-gray-500 dark:text-stone-400">
                Auto-fix ke liye pehle login karein aur apni WordPress site connect karein.
              </p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-stone-400">
                Auto-fix ke liye pehle{' '}
                <Link href="/optimizer" className="text-[#8B85E3] underline">
                  Optimizer
                </Link>{' '}
                mein apni WordPress site connect karein. Site connect hone se pehle payment nahi liya jayega.
              </p>
            )}
          </section>
        </section>
      )}
    </main>
  );
}