import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildReportHtml, generatePdfBuffer } from '@/lib/generateBeforeAfterPdf';

export const runtime = 'nodejs';
export const maxDuration = 60; // Puppeteer cold-start thoda time leta hai

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function loadSnapshot(supabase: any, auditId: string) {
  const { data: audit } = await supabase.from('audits').select('*').eq('id', auditId).single();
  if (!audit) return null;

  const { data: mentions } = await supabase
    .from('ai_mentions')
    .select('source, mentioned, sentiment')
    .eq('audit_id', auditId);

  return {
    brandName: audit.brand_name,
    city: audit.target_city,
    date: new Date(audit.created_at).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    localScore: audit.local_visibility_score,
    websiteScore: audit.visibility_score,
    mentions: mentions ?? [],
  };
}

export async function POST(req: NextRequest) {
  try {
    const { beforeAuditId, afterAuditId, agencyName } = await req.json();

    if (!beforeAuditId || !afterAuditId) {
      return NextResponse.json({ error: 'beforeAuditId aur afterAuditId dono chahiye' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const before = await loadSnapshot(supabase, beforeAuditId);
    const after = await loadSnapshot(supabase, afterAuditId);

    if (!before || !after) {
      return NextResponse.json({ error: 'Audit(s) not found' }, { status: 404 });
    }

    const html = buildReportHtml(before, after, agencyName);
    const pdfBuffer = await generatePdfBuffer(html);

    // Fix: Buffer ko Uint8Array mein convert karo taaki BodyInit type match kare
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${before.brandName.replace(/\s+/g, '_')}_Before_After_Report.pdf"`,
      },
    });
  } catch (err: any) {
    console.error('before-after report error:', err);
    return NextResponse.json({ error: err.message || 'Report generate nahi ho payi' }, { status: 500 });
  }
}
