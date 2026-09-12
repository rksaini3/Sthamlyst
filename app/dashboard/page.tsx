'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AuditGraph from '@/components/AuditGraph';
import FixButton from '@/components/FixButton';
import type { AuditReport } from '@/types';

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const auditId = searchParams.get('audit');

  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auditId) {
      router.push('/');
      return;
    }
    loadReport(auditId);
  }, [auditId]);

  async function loadReport(id: string) {
    setLoading(true);
    const { data: audit, error: auditErr } = await supabase
      .from('audits')
      .select('*')
      .eq('id', id)
      .single();

    if (auditErr || !audit) {
      setError('Audit not found');
      setLoading(false);
      return;
    }

    const { data: mentions } = await supabase
      .from('ai_mentions')
      .select('*')
      .eq('audit_id', id);

    const { data: googleResults } = await supabase
      .from('google_ai_overview_results')
      .select('*')
      .eq('audit_id', id);

    setReport({
      ...audit,
      ai_mentions: mentions ?? [],
      google_results: googleResults ?? [],
    });
    setLoading(false);
  }

  if (loading) return <main className="p-6">Loading your report…</main>;
  if (error || !report) return <main className="p-6">{error}</main>;

  return (
    <main className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">{report.brand_name}</h1>
      <p className="text-gray-500 mb-6">{report.website_url}</p>

      <AuditGraph score={report.visibility_score ?? 0} />

      <section className="mt-8 space-y-3">
        <h2 className="font-semibold text-lg">AI Mentions</h2>
        {report.ai_mentions.map((m) => (
          <div key={m.id} className="border rounded-lg p-4">
            <p className="font-medium capitalize">{m.source}</p>
            <p className="text-sm text-gray-600">
              {m.mentioned ? '✅ Mentioned' : '❌ Not mentioned'}
              {m.sentiment ? ` · ${m.sentiment}` : ''}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="font-semibold text-lg mb-2">Fix Issues Automatically</h2>
        <FixButton auditId={report.id} />
      </section>
    </main>
  );
}