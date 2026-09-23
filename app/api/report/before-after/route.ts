import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildReportHtml, generatePdfBuffer } from '@/lib/generateBeforeAfterPdf';
import { loadSnapshot, loadFixesSince } from '@/lib/reportData';

export const runtime = 'nodejs';
export const maxDuration = 60; // Puppeteer cold-start thoda time leta hai

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function safeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'Brand';
}

export async function POST(req: NextRequest) {
  try {
    const { beforeAuditId, afterAuditId, agencyName, lang } = await req.json();

    if (!beforeAuditId || !afterAuditId) {
      return NextResponse.json({ error: 'beforeAuditId aur afterAuditId dono chahiye' }, { status: 400 });
    }
    if (beforeAuditId === afterAuditId) {
      return NextResponse.json({ error: 'Before aur After audit alag hone chahiye' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const before = await loadSnapshot(supabase, beforeAuditId);
    const after = await loadSnapshot(supabase, afterAuditId);

    if (!before || !after) {
      return NextResponse.json({ error: 'Audit(s) not found' }, { status: 404 });
    }

    const fixes = await loadFixesSince(supabase, before);
    const agency = typeof agencyName === 'string' ? agencyName.trim().slice(0, 60) : undefined;
    const reportLang = lang === 'hi' ? 'hi' : 'en';
    const html = buildReportHtml(before, after, agency || undefined, fixes, reportLang);
    const pdf = await generatePdfBuffer(html, reportLang);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFileName(before.brandName)}_Before_After_Report.pdf"`,
      },
    });
  } catch (err: any) {
    console.error('before-after report error:', err);
    return NextResponse.json({ error: err.message || 'Report generate nahi ho payi' }, { status: 500 });
  }
}
