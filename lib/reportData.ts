// Report ke liye shared data loading + gap analysis (Gap PDF aur Before/After PDF dono yahi use karte hain)

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
export function analyzeGaps(s: AuditSnapshot): Gap[] {
  const gaps: Gap[] = [];
  const local = s.mentions.filter((m) => m.isLocal);
  const web = s.mentions.filter((m) => !m.isLocal);
  const ls = stat(local);
  const ws = stat(web);

  if (ls.usable > 0 && ls.yes === 0) {
    gaps.push({
      severity: 'high',
      title: `${s.city} mein koi bhi AI model aapke business ko nahi pehchanta`,
      detail: `Local check mein ${ls.no} me se ${ls.no} AI model ne bola ki unhe ${s.brandName} ke baare mein specific jaankari nahi hai.`,
      action:
        'Google Business Profile poora bharein (sahi category, description, services, photos). Business ka naam, address aur phone har jagah (JustDial, Facebook, Instagram, IndiaMART) same rakhein. Ache reviews badhayein.',
    });
  } else if (ls.usable > 0 && ls.no > 0) {
    gaps.push({
      severity: 'medium',
      title: `${ls.no} AI model local search mein aapko nahi pehchante`,
      detail: `${ls.usable} me se sirf ${ls.yes} model ne ${s.brandName} ko pehchana.`,
      action:
        'Google Business Profile aur online listings ko update rakhein aur local news/directories mein business ka zikr badhayein.',
    });
  }

  if (s.hasWebsite) {
    if (ws.usable > 0 && ws.yes === 0) {
      gaps.push({
        severity: 'high',
        title: 'AI models website/brand ko general search mein nahi pehchante',
        detail: `${ws.no} AI model ne bola ki unke paas ${s.brandName} ki specific jaankari nahi hai.`,
        action:
          'Website par Organization schema, saaf About page aur FAQ page lagayein. Doosri trusted sites (news, directories, social profiles) par brand ka zikr badhayein.',
      });
    } else if (ws.usable > 0 && ws.no > 0) {
      gaps.push({
        severity: 'medium',
        title: `${ws.no} AI model general search mein aapko nahi pehchante`,
        detail: `${ws.usable} me se ${ws.yes} model ne ${s.brandName} ko pehchana.`,
        action: 'Structured data (schema) aur FAQ content se brand ki pehchaan clear karein.',
      });
    }

    const mentionedNoCitation = web.filter((m) => m.mentioned === true && !m.citationUrl).length;
    if (mentionedNoCitation > 0) {
      gaps.push({
        severity: 'low',
        title: 'AI models ne source link nahi diya',
        detail: `${mentionedNoCitation} model ne brand ko pehchana par koi specific source URL nahi bataya.`,
        action: 'Website ke About/FAQ pages ko clear aur crawlable rakhein taaki AI unhe source ke roop mein use kar sake.',
      });
    }

    if (s.google) {
      if (!s.google.appearsInOverview) {
        gaps.push({
          severity: 'medium',
          title: 'Google Knowledge Panel / Answer Box mein brand nahi dikhta',
          detail: `"${s.brandName}" search karne par Google ke answer box ya knowledge panel mein aapka brand nahi aaya.`,
          action: 'Google Business Profile claim/verify karein aur website par Organization schema lagayein.',
        });
      }
      if (s.google.rankedPosition === null) {
        gaps.push({
          severity: 'high',
          title: 'Brand naam search karne par website top results mein nahi',
          detail: `"${s.brandName}" search karne par aapki website pehle 10 organic results mein nahi mili.`,
          action:
            'Home page ke title/heading mein brand naam rakhein, Google Search Console mein site verify karke sitemap submit karein, aur social profiles se website link karein.',
        });
      } else if (s.google.rankedPosition > 3) {
        gaps.push({
          severity: 'low',
          title: `Brand search mein website ${s.google.rankedPosition} number par hai`,
          detail: 'Brand naam search par website top 3 mein nahi hai.',
          action: 'Website ke title/meta description aur backlinks sudharein.',
        });
      }
    }
  } else {
    gaps.push({
      severity: 'medium',
      title: 'Website nahi hai — AI ko cite karne ke liye koi source nahi',
      detail: 'Bina website ke AI assistants ke paas aapke business ka koi official source nahi hota.',
      action:
        'Ek simple website banayein (naam, services, address, phone, FAQ) aur usme schema markup lagayein.',
    });
  }

  const negative = s.mentions.filter((m) => m.mentioned === true && m.sentiment === 'negative').length;
  if (negative > 0) {
    gaps.push({
      severity: 'high',
      title: 'Kuch AI models ka sentiment negative hai',
      detail: `${negative} model ne brand ko negative tone mein bataya.`,
      action: 'Negative reviews ka polite jawab dein aur naye positive reviews/case studies publish karein.',
    });
  }

  const unclear = ls.unclear + ws.unclear;
  if (unclear > 0) {
    gaps.push({
      severity: 'low',
      title: `${unclear} check ka jawab nahi mil paya`,
      detail: 'Kuch AI models us waqt jawab nahi de paye, isliye woh check score mein shamil nahi hue.',
      action: 'Kuch der baad dobara audit chalayein.',
    });
  }

  const order = { high: 0, medium: 1, low: 2 } as const;
  gaps.sort((a, b) => order[a.severity] - order[b.severity]);
  return gaps;
}

export function scoreBand(score: number | null): string {
  if (score === null) return 'N/A';
  if (score >= 70) return 'Strong';
  if (score >= 40) return 'Average';
  return 'Weak';
}
