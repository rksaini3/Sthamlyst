import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildGapReportHtml, generatePdfBuffer } from '@/lib/generateBeforeAfterPdf';
import { loadSnapshot } from '@/lib/reportData';

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
    const { auditId, agencyName, lang } = await req.json();

    if (!auditId) {
      return NextResponse.json({ error: 'auditId chahiye' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const snapshot = await loadSnapshot(supabase, auditId);

    if (!snapshot) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
    }

    const agency = typeof agencyName === 'string' ? agencyName.trim().slice(0, 60) : undefined;
    const reportLang = lang === 'hi' ? 'hi' : 'en';
    const html = buildGapReportHtml(snapshot, agency || undefined, reportLang);
    const pdf = await generatePdfBuffer(html, reportLang);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFileName(snapshot.brandName)}_Gap_Report.pdf"`,
      },
    });
  } catch (err: any) {
    console.error('gap report error:', err);
    return NextResponse.json({ error: err.message || 'Report generate nahi ho payi' }, { status: 500 });
  }
}