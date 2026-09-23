// Report ke liye shared data loading + gap analysis (Gap PDF aur Before/After PDF dono yahi use karte hain)
import type { Language } from './i18n';

export interface MentionSummary {
  source: string;
  mentioned: boolean | null;
  sentiment: string | null;
  citationUrl: string | null;
  isLocal: boolean;
}

export interface GoogleSummary {
  appearsInOverview: boolean;
  rankedPosition: number | null;
}

export interface AuditSnapshot {
  id: string;
  brandName: string;
  city: string;
  websiteUrl: string | null;
  hasWebsite: boolean;
  createdAt: string;
  date: string;
  localScore: number | null;
  websiteScore: number | null;
  mentions: MentionSummary[];
  google: GoogleSummary | null;
}

export interface FixSummary {
  label: string;
  site: string | null;
  appliedAt: string;
}

export interface Gap {
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  action: string;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export async function loadSnapshot(supabase: any, auditId: string): Promise<AuditSnapshot | null> {
  const { data: audit } = await supabase.from('audits').select('*').eq('id', auditId).single();
  if (!audit) return null;

  const { data: mentions } = await supabase
    .from('ai_mentions')
    .select('source, mentioned, sentiment, citation_url, is_local')
    .eq('audit_id', auditId);

  const { data: googleRows } = await supabase
    .from('google_ai_overview_results')
    .select('appears_in_overview, ranked_position')
    .eq('audit_id', auditId)
    .limit(1);

  const g: any = googleRows && googleRows.length > 0 ? googleRows[0] : null;

  return {
    id: audit.id,
    brandName: audit.brand_name,
    city: audit.target_city,
    websiteUrl: audit.website_url ?? null,
    hasWebsite: !!audit.has_website,
    createdAt: audit.created_at,
    date: formatDate(audit.created_at),
    localScore: audit.local_visibility_score ?? null,
    websiteScore: audit.visibility_score ?? null,
    mentions: ((mentions ?? []) as any[]).map((m: any) => ({
      source: m.source,
      mentioned: m.mentioned,
      sentiment: m.sentiment ?? null,
      citationUrl: m.citation_url ?? null,
      isLocal: !!m.is_local,
    })),
    google: g
      ? { appearsInOverview: !!g.appears_in_overview, rankedPosition: g.ranked_position ?? null }
      : null,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => '\\' + c);
}

const FIX_LABELS: Record<string, string> = {
  schema_markup: 'Organization schema + FAQ page (AI-readable structured data)',
  faq_section: 'FAQ page with FAQ schema',
  meta_tags: 'Meta tags update',
};

// Is brand+city ke saare audits par jo paid+applied fixes lage, unki list (before ke baad ke)
export async function loadFixesSince(supabase: any, before: AuditSnapshot): Promise<FixSummary[]> {
  try {
    let q = supabase
      .from('audits')
      .select('id')
      .ilike('brand_name', escapeLike(before.brandName))
      .eq('target_city', before.city);
    q = before.websiteUrl ? q.eq('website_url', before.websiteUrl) : q.is('website_url', null);
    const { data: audits } = await q;
    const ids: string[] = ((audits ?? []) as any[]).map((a: any) => a.id);
    if (ids.length === 0) return [];

    const { data: opts } = await supabase
      .from('optimizations')
      .select('fix_type, applied_at, wordpress_connection_id, shopify_connection_id')
      .in('audit_id', ids)
      .eq('status', 'applied')
      .eq('payment_status', 'paid')
      .gte('applied_at', before.createdAt)
      .order('applied_at', { ascending: true });

    const rows: any[] = opts ?? [];
    const wpIds = rows.map((r: any) => r.wordpress_connection_id).filter(Boolean);
    const shIds = rows.map((r: any) => r.shopify_connection_id).filter(Boolean);

    const wpMap: Record<string, string> = {};
    const shMap: Record<string, string> = {};

    if (wpIds.length > 0) {
      const { data: wp } = await supabase.from('wordpress_connections').select('id, site_url').in('id', wpIds);
      ((wp ?? []) as any[]).forEach((c: any) => {
        wpMap[c.id] = c.site_url;
      });
    }
    if (shIds.length > 0) {
      const { data: sh } = await supabase.from('shopify_connections').select('id, shop_domain').in('id', shIds);
      ((sh ?? []) as any[]).forEach((c: any) => {
        shMap[c.id] = c.shop_domain;
      });
    }

    return rows.map((r: any) => ({
      label: FIX_LABELS[r.fix_type] ?? 'Website fix',
      site:
        (r.wordpress_connection_id && wpMap[r.wordpress_connection_id]) ||
        (r.shopify_connection_id && shMap[r.shopify_connection_id]) ||
        null,
      appliedAt: r.applied_at ? formatDate(r.applied_at) : '—',
    }));
  } catch (e) {
    console.error('loadFixesSince failed:', e);
    return [];
  }
}

function stat(list: MentionSummary[]) {
  const usable = list.filter((m) => m.mentioned !== null);
  return {
    total: list.length,
    usable: usable.length,
    yes: usable.filter((m) => m.mentioned === true).length,
    no: usable.filter((m) => m.mentioned === false).length,
    unclear: list.length - usable.length,
  };
}

// Sirf audit ke actual data se kamiyan nikalta hai — koi assumption ya guarantee nahi
// `lang` decide karta hai ki gap ka title/detail/action English mein aaye ya Hindi (Devanagari) mein.
export function analyzeGaps(s: AuditSnapshot, lang: Language = 'en'): Gap[] {
  const gaps: Gap[] = [];
  const local = s.mentions.filter((m) => m.isLocal);
  const web = s.mentions.filter((m) => !m.isLocal);
  const ls = stat(local);
  const ws = stat(web);
  const isHi = lang === 'hi';

  if (ls.usable > 0 && ls.yes === 0) {
    gaps.push({
      severity: 'high',
      title: isHi
        ? `${s.city} में कोई भी AI मॉडल आपके बिज़नेस को नहीं पहचानता`
        : `No AI model recognizes your business in ${s.city}`,
      detail: isHi
        ? `लोकल चेक में ${ls.usable} में से ${ls.no} AI मॉडल ने कहा कि उनके पास ${s.brandName} के बारे में कोई खास जानकारी नहीं है।`
        : `In the local check, ${ls.no} out of ${ls.usable} AI models said they don't have specific information about ${s.brandName}.`,
      action: isHi
        ? 'Google Business Profile पूरी तरह भरें (सही कैटेगरी, विवरण, सेवाएं, फ़ोटो)। बिज़नेस का नाम, पता और फ़ोन नंबर हर जगह (JustDial, Facebook, Instagram, IndiaMART) एक जैसा रखें। अच्छे रिव्यू बढ़ाएं।'
        : 'Fully fill out your Google Business Profile (correct category, description, services, photos). Keep your business name, address, and phone number consistent everywhere (JustDial, Facebook, Instagram, IndiaMART). Build up genuine positive reviews.',
    });
  } else if (ls.usable > 0 && ls.no > 0) {
    gaps.push({
      severity: 'medium',
      title: isHi
        ? `${ls.no} AI मॉडल लोकल सर्च में आपको नहीं पहचानते`
        : `${ls.no} AI models don't recognize you in local search`,
      detail: isHi
        ? `${ls.usable} में से सिर्फ़ ${ls.yes} मॉडल ने ${s.brandName} को पहचाना।`
        : `Only ${ls.yes} out of ${ls.usable} models recognized ${s.brandName}.`,
      action: isHi
        ? 'Google Business Profile और ऑनलाइन लिस्टिंग अपडेट रखें और लोकल न्यूज़/डायरेक्टरी में बिज़नेस का ज़िक्र बढ़ाएं।'
        : 'Keep your Google Business Profile and online listings updated, and increase mentions of your business in local news/directories.',
    });
  }

  if (s.hasWebsite) {
    if (ws.usable > 0 && ws.yes === 0) {
      gaps.push({
        severity: 'high',
        title: isHi
          ? 'AI मॉडल सामान्य सर्च में आपकी वेबसाइट/ब्रांड को नहीं पहचानते'
          : "AI models don't recognize your website/brand in general search",
        detail: isHi
          ? `${ws.no} AI मॉडल ने कहा कि उनके पास ${s.brandName} की कोई खास जानकारी नहीं है।`
          : `${ws.no} AI models said they don't have specific information about ${s.brandName}.`,
        action: isHi
          ? 'वेबसाइट पर Organization schema, साफ़ About पेज और FAQ पेज लगाएं। भरोसेमंद अन्य साइटों (न्यूज़, डायरेक्टरी, सोशल प्रोफ़ाइल) पर ब्रांड का ज़िक्र बढ़ाएं।'
          : 'Add Organization schema, a clear About page, and an FAQ page to your website. Increase mentions of your brand on other trusted sites (news, directories, social profiles).',
      });
    } else if (ws.usable > 0 && ws.no > 0) {
      gaps.push({
        severity: 'medium',
        title: isHi
          ? `${ws.no} AI मॉडल सामान्य सर्च में आपको नहीं पहचानते`
          : `${ws.no} AI models don't recognize you in general search`,
        detail: isHi
          ? `${ws.usable} में से ${ws.yes} मॉडल ने ${s.brandName} को पहचाना।`
          : `${ws.yes} out of ${ws.usable} models recognized ${s.brandName}.`,
        action: isHi
          ? 'स्ट्रक्चर्ड डेटा (schema) और FAQ कंटेंट से ब्रांड की पहचान साफ़ करें।'
          : 'Make your brand identity clear with structured data (schema) and FAQ content.',
      });
    }

    const mentionedNoCitation = web.filter((m) => m.mentioned === true && !m.citationUrl).length;
    if (mentionedNoCitation > 0) {
      gaps.push({
        severity: 'low',
        title: isHi ? 'AI मॉडल ने सोर्स लिंक नहीं दिया' : "AI models didn't provide a source link",
        detail: isHi
          ? `${mentionedNoCitation} मॉडल ने ब्रांड को पहचाना पर कोई खास सोर्स URL नहीं बताया।`
          : `${mentionedNoCitation} models recognized the brand but didn't mention a specific source URL.`,
        action: isHi
          ? 'वेबसाइट के About/FAQ पेज साफ़ और crawlable रखें ताकि AI उन्हें सोर्स के तौर पर इस्तेमाल कर सके।'
          : "Keep your website's About/FAQ pages clear and crawlable so AI can use them as a source.",
      });
    }

    if (s.google) {
      if (!s.google.appearsInOverview) {
        gaps.push({
          severity: 'medium',
          title: isHi
            ? 'Google Knowledge Panel / Answer Box में ब्रांड नहीं दिखता'
            : "Brand doesn't appear in Google's Knowledge Panel / Answer Box",
          detail: isHi
            ? `"${s.brandName}" सर्च करने पर Google के answer box या knowledge panel में आपका ब्रांड नहीं आया।`
            : `Searching for "${s.brandName}" doesn't show your brand in Google's answer box or knowledge panel.`,
          action: isHi
            ? 'Google Business Profile claim/verify करें और वेबसाइट पर Organization schema लगाएं।'
            : 'Claim/verify your Google Business Profile and add Organization schema to your website.',
        });
      }
      if (s.google.rankedPosition === null) {
        gaps.push({
          severity: 'high',
          title: isHi
            ? 'ब्रांड नाम सर्च करने पर वेबसाइट टॉप रिज़ल्ट्स में नहीं है'
            : "Website doesn't appear in top results when searching your brand name",
          detail: isHi
            ? `"${s.brandName}" सर्च करने पर आपकी वेबसाइट पहले 10 ऑर्गेनिक रिज़ल्ट्स में नहीं मिली।`
            : `Searching for "${s.brandName}" doesn't show your website in the first 10 organic results.`,
          action: isHi
            ? 'होम पेज के title/heading में ब्रांड नाम रखें, Google Search Console में साइट वेरिफ़ाई करके sitemap सबमिट करें, और सोशल प्रोफ़ाइल से वेबसाइट लिंक करें।'
            : 'Include your brand name in the home page title/heading, verify your site in Google Search Console and submit a sitemap, and link to your website from your social profiles.',
        });
      } else if (s.google.rankedPosition > 3) {
        gaps.push({
          severity: 'low',
          title: isHi
            ? `ब्रांड सर्च में वेबसाइट नंबर ${s.google.rankedPosition} पर है`
            : `Website ranks #${s.google.rankedPosition} for a brand-name search`,
          detail: isHi
            ? 'ब्रांड नाम सर्च करने पर वेबसाइट टॉप 3 में नहीं है।'
            : "Your website isn't in the top 3 when searching your brand name.",
          action: isHi
            ? 'वेबसाइट के title/meta description और बैकलिंक्स सुधारें।'
            : "Improve your website's title/meta description and backlinks.",
        });
      }
    }
  } else {
    gaps.push({
      severity: 'medium',
      title: isHi
        ? 'वेबसाइट नहीं है — AI के लिए कोई सोर्स नहीं'
        : 'No website — nothing for AI to cite as a source',
      detail: isHi
        ? 'बिना वेबसाइट के AI असिस्टेंट्स के पास आपके बिज़नेस का कोई ऑफ़िशियल सोर्स नहीं होता।'
        : 'Without a website, AI assistants have no official source for your business.',
      action: isHi
        ? 'एक आसान वेबसाइट बनाएं (नाम, सेवाएं, पता, फ़ोन, FAQ) और उसमें schema markup लगाएं।'
        : 'Build a simple website (name, services, address, phone, FAQ) and add schema markup to it.',
    });
  }

  const negative = s.mentions.filter((m) => m.mentioned === true && m.sentiment === 'negative').length;
  if (negative > 0) {
    gaps.push({
      severity: 'high',
      title: isHi ? 'कुछ AI मॉडल का सेंटिमेंट नेगेटिव है' : 'Some AI models have a negative sentiment',
      detail: isHi
        ? `${negative} मॉडल ने ब्रांड को नेगेटिव टोन में बताया।`
        : `${negative} models described the brand in a negative tone.`,
      action: isHi
        ? 'नेगेटिव रिव्यू का विनम्रता से जवाब दें और नए पॉज़िटिव रिव्यू/केस स्टडी पब्लिश करें।'
        : 'Respond politely to negative reviews and publish new positive reviews/case studies.',
    });
  }

  const unclear = ls.unclear + ws.unclear;
  if (unclear > 0) {
    gaps.push({
      severity: 'low',
      title: isHi ? `${unclear} चेक का जवाब नहीं मिल पाया` : `${unclear} checks didn't get an answer`,
      detail: isHi
        ? 'कुछ AI मॉडल उस समय जवाब नहीं दे पाए, इसलिए वो चेक स्कोर में शामिल नहीं हुए।'
        : "Some AI models didn't respond at that time, so those checks weren't included in the score.",
      action: isHi ? 'कुछ देर बाद दोबारा ऑडिट चलाएं।' : 'Run the audit again after a while.',
    });
  }

  const order = { high: 0, medium: 1, low: 2 } as const;
  gaps.sort((a, b) => order[a.severity] - order[b.severity]);
  return gaps;
}

export function scoreBand(score: number | null, lang: Language = 'en'): string {
  if (lang === 'hi') {
    if (score === null) return 'उपलब्ध नहीं';
    if (score >= 70) return 'मज़बूत';
    if (score >= 40) return 'औसत';
    return 'कमज़ोर';
  }
  if (score === null) return 'N/A';
  if (score >= 70) return 'Strong';
  if (score >= 40) return 'Average';
  return 'Weak';
}
