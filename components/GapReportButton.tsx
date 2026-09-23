'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { downloadPdfFromResponse, safeFileName } from '@/lib/downloadPdf';
import { useLanguage } from '@/lib/LanguageProvider';

interface Props {
  auditId: string;
  brandName: string;
  isFirstAudit?: boolean;
  agencyName?: string;
}

export default function GapReportButton({ auditId, brandName, isFirstAudit, agencyName }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { lang } = useLanguage();

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/report/gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId, agencyName, lang }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Report download nahi ho payi');
      }
      await downloadPdfFromResponse(res, `${safeFileName(brandName)}_Gap_Report.pdf`);
    } catch (err: any) {
      setError(err.message || 'Kuch galat ho gaya');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-[#8B85E3]/40 bg-[#8B85E3]/5 p-4">
      {isFirstAudit && (
        <p className="text-sm text-stone-700 dark:text-stone-300 mb-3">
          Ye aapka pehla audit hai. Isi ko &quot;Before&quot; snapshot maana jayega. Kamiyon ka PDF report abhi download kar lein.
        </p>
      )}
      <button
        onClick={handleDownload}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-[#8B85E3] hover:bg-[#7A73D8] text-white rounded-xl px-5 py-3 font-semibold text-sm disabled:opacity-50 transition-colors"
      >
        <FileText size={16} />
        {loading ? 'Report ban rahi hai…' : 'Download Gap Report (PDF)'}
      </button>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
