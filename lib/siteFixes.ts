import {
  SCHEMA_MARKER,
  buildAboutHtml,
  buildFaqHtml,
  buildOrganizationSchema,
  generateFaqs,
  jsonLdScript,
  type BrandInfo,
} from '@/lib/fixContent';

export interface FixResult {
  ok: boolean;
  error?: string;
}

// 'schema_markup' = bundle (Organization schema + FAQ page). 'faq_section' = sirf FAQ page.
function wantsSchema(fixType: string): boolean {
  return fixType === 'schema_markup';
}
function wantsFaq(fixType: string): boolean {
  return fixType === 'schema_markup' || fixType === 'faq_section';
}

function wpBlock(html: string): string {
  return `<!-- wp:html -->\n${html}\n<!-- /wp:html -->`;
}

// ---------------- WordPress ----------------

async function wpRequest(base: string, auth: string, path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${base}/wp-json${path}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

export async function applyWordPressFixes(
  conn: { site_url: string; wp_username: string; password: string },
  brand: BrandInfo,
  fixType: string
): Promise<FixResult> {
  const base = conn.site_url.replace(/\/+$/, '');
  const auth = Buffer.from(`${conn.wp_username}:${conn.password}`).toString('base64');

  if (wantsSchema(fixType)) {
    const schemaHtml = `<!-- ${SCHEMA_MARKER} -->\n${jsonLdScript(buildOrganizationSchema(brand))}`;

    const settings = await wpRequest(base, auth, '/wp/v2/settings');
    const frontId = settings.ok ? Number(settings.json?.page_on_front) || 0 : 0;

    if (frontId > 0) {
      // Homepage ke content mein sirf END mein schema jodte hain — purana content chhua nahi jaata
      const page = await wpRequest(base, auth, `/wp/v2/pages/${frontId}?context=edit`);
      if (!page.ok) {
        return { ok: false, error: `WordPress homepage padh nahi paye (${page.status}): ${page.text.slice(0, 300)}` };
      }
      const raw = String(page.json?.content?.raw ?? '');
      if (!raw.includes(SCHEMA_MARKER)) {
        const upd = await wpRequest(base, auth, `/wp/v2/pages/${frontId}`, 'POST', {
          content: `${raw}\n\n${wpBlock(schemaHtml)}`,
        });
        if (!upd.ok) {
          return { ok: false, error: `WordPress homepage update failed (${upd.status}): ${upd.text.slice(0, 300)}` };
        }
      }
    } else {
      // Static homepage set nahi hai — ek "About" page banate hain jisme schema ho
      const existing = await wpRequest(base, auth, '/wp/v2/pages?slug=sthamly-about&status=any&context=edit');
      const already = existing.ok && Array.isArray(existing.json) && existing.json.length > 0;
      if (!already) {
        const created = await wpRequest(base, auth, '/wp/v2/pages', 'POST', {
          title: `About ${brand.brandName}`,
          slug: 'sthamly-about',
          status: 'publish',
          content: wpBlock(`${buildAboutHtml(brand)}\n${schemaHtml}`),
        });
        if (!created.ok) {
          return { ok: false, error: `WordPress schema page failed (${created.status}): ${created.text.slice(0, 300)}` };
        }
      }
    }
  }

  if (wantsFaq(fixType)) {
    const existing = await wpRequest(base, auth, '/wp/v2/pages?slug=ai-faq&status=any&context=edit');
    const already = existing.ok && Array.isArray(existing.json) && existing.json.length > 0;
    if (!already) {
      const faqs = await generateFaqs(brand);
      const created = await wpRequest(base, auth, '/wp/v2/pages', 'POST', {
        title: 'FAQ',
        slug: 'ai-faq',
        status: 'publish',
        content: wpBlock(buildFaqHtml(brand, faqs)),
      });
      if (!created.ok) {
        return { ok: false, error: `WordPress FAQ page failed (${created.status}): ${created.text.slice(0, 300)}` };
      }
    }
  }

  return { ok: true };
}
