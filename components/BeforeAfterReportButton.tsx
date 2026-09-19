'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface Props {
  currentAuditId: string;
  brandName: string;
  city: string;
}

export default function BeforeAfterReportButton({ currentAuditId, brandName, city }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);

    try {
      // Isi brand + city ka sabse pehla audit dhoondo — wahi "Before" hoga
      const { data: earliestAudit } = await supabase
        .from('audits')
        .select('id')
        .eq('brand_name', brandName)
        .eq('target_city', city)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (!earliestAudit || earliestAudit.id === currentAuditId) {
        setError('Compare karne ke liye kam se kam 2 audits chahiye (fix se pehle aur baad mein) — dobara audit chalayein fix ke baad.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/report/before-after', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beforeAuditId: earliestAudit.id,
          afterAuditId: currentAuditId,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Report download nahi ho payi');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${brandName.replace(/\s+/g, '_')}_Before_After_Report.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Kuch galat ho gaya');
    } finally {
      setLoading(false);
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
        {loading ? 'Report ban rahi hai…' : 'Download Before/After Report'}
      </button>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
