'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { downloadPdfFromResponse, safeFileName } from '@/lib/downloadPdf';

interface Props {
  currentAuditId: string;
  brandName: string;
  city: string;
  websiteUrl?: string | null;
  agencyName?: string;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => '\\' + c);
}

export default function BeforeAfterReportButton({ currentAuditId, brandName, city, websiteUrl, agencyName }: Props) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);

    try {
      // 1) Isi brand + city (+ same website) ke saare complete audits — sabse pehla = "Before"
      setStep('Purane audits dhoondh rahe hain…');
      let q = supabase
        .from('audits')
        .select('id, created_at')
        .ilike('brand_name', escapeLike(brandName))
        .eq('target_city', city)
        .eq('status', 'complete')
        .order('created_at', { ascending: true });
      q = websiteUrl ? q.eq('website_url', websiteUrl) : q.is('website_url', null);

      const { data: audits, error: auditsErr } = await q;
      if (auditsErr || !audits || audits.length === 0) {
        throw new Error('Pehle audit ka record nahi mila');
      }

      const before = audits[0];
      const latest = audits[audits.length - 1];

      // 2) Sabse recent applied fix ka time
      const { data: fixRows } = await supabase
        .from('optimizations')
        .select('applied_at')
        .in('audit_id', audits.map((a) => a.id))
        .eq('status', 'applied')
        .eq('payment_status', 'paid')
        .order('applied_at', { ascending: false })
        .limit(1);

      const fixAt = fixRows && fixRows.length > 0 && fixRows[0].applied_at ? new Date(fixRows[0].applied_at) : null;

      // 3) "After" audit: fix ke BAAD ka koi audit chahiye. Nahi hai to abhi fresh audit chalao.
      let afterId = latest.id;
      const needFreshAudit =
        latest.id === before.id || (fixAt !== null && new Date(latest.created_at).getTime() <= fixAt.getTime());

      if (needFreshAudit) {
        setStep('Fix ke baad ka naya audit chal raha hai (1-2 min)…');
        const { data: userData } = await supabase.auth.getUser();
        const auditRes = await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandName,
            city,
            websiteUrl: websiteUrl || undefined,
            userId: userData.user?.id ?? null,
            force: true,
          }),
        });
        if (!auditRes.ok) {
          const body = await auditRes.json().catch(() => ({}));
          throw new Error(body.error || 'Naya audit nahi chal paya');
        }
        const { auditId } = await auditRes.json();
        afterId = auditId;
      }

      if (afterId === before.id) {
        throw new Error('Compare karne ke liye Before aur After alag audits hone chahiye');
      }

      // 4) PDF banwao aur download karo
      setStep('PDF ban rahi hai…');
      const res = await fetch('/api/report/before-after', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beforeAuditId: before.id, afterAuditId: afterId, agencyName }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Report download nahi ho payi');
      }

      await downloadPdfFromResponse(res, `${safeFileName(brandName)}_Before_After_Report.pdf`);
    } catch (err: any) {
      setError(err.message || 'Kuch galat ho gaya');
    } finally {
      setLoading(false);
      setStep('');
    }
  }

  return (
    <div>
      <button
        onClick={handleDownload}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 border border-stone-300 dark:border-stone-700 rounded-xl px-5 py-3 font-semibold text-sm hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50 transition-colors"
      >
        <FileText size={16} />
        {loading ? step || 'Report ban rahi hai…' : 'Download Before/After Report (PDF)'}
      </button>
      <p className="text-xs text-gray-500 dark:text-stone-400 mt-2">
        Ye button fix ke baad ka naya audit chalakar pehle audit se compare karta hai. AI models ko naya data pick karne mein
        2-4 hafte lag sakte hain, isliye turant score na badle to ghabraiye nahi. Kuch hafte baad dobara try karein.
      </p>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}