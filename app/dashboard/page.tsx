'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AuditGraph from '@/components/AuditGraph';
import FixButton from '@/components/FixButton';
import type { AuditReport } from '@/types';

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <DashboardContent />
    </Suspense>
  );
}

function mentionBadge(mentioned: boolean | null) {
  if (mentioned === true) {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        ✅ Mentioned
      </span>
    );
  }
  if (mentioned === false) {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
        ❌ Not mentioned
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
      ⚠️ Could not check
    </span>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const auditId = searchParams.get('audit');

  const [report, setReport] = useState<AuditReport | null>(null);
  const [optimizationId, setOptimizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'maps' | 'website'>('maps');

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

    if (audit.has_website) {
      const { data: userData } = await supabase.auth.getUser();
      const { data: wpConn } = await supabase
        .from('wordpress_connections')
        .select('id')
        .eq('user_id', userData.user?.id ?? '')
        .limit(1)
        .maybeSingle();

      const { data: optimization } = await supabase
        .from('optimizations')
        .insert({
          audit_id: id,
          wordpress_connection_id: wpConn?.id ?? null,
          fix_type: 'schema_markup',
          status: 'pending',
          payment_status: 'unpaid',
        })
        .select()
        .single();

      setOptimizationId(optimization?.id ?? null);
    }

    setReport({
      ...audit,
      ai_mentions: mentions ?? [],
      google_results: googleResults ?? [],
    });
    setLoading(false);
  }

  if (loading) return <main className="p-6">Loading your report…</main>;
  if (error || !report) return <main className="p-6">{error}</main>;

  const localMentions = report.ai_mentions.filter((m) => m.is_local);
  const websiteMentions = report.ai_mentions.filter((m) => !m.is_local);

  return (
    <main className="min-h-screen px-6 py-10 max-w-2xl mx-auto pb-24">
      <h1 className="text-2xl font-bold mb-1">{report.brand_name}</h1>
      <p className="text-gray-500 mb-6">{report.target_city}</p>

      {report.has_website && (
        <div className="flex border-b mb-6">
          <button
            onClick={() => setActiveTab('maps')}
            className={`flex-1 py-2 text-sm font-semibold ${
              activeTab === 'maps' ? 'border-b-2 border-orange-700 text-orange-700' : 'text-gray-500'
            }`}
          >
            📍 Maps Visibility
          </button>
          <button
            onClick={() => setActiveTab('website')}
            className={`flex-1 py-2 text-sm font-semibold ${
              activeTab === 'website' ? 'border-b-2 border-orange-700 text-orange-700' : 'text-gray-500'
            }`}
          >
            🌐 Website AI Score
          </button>
        </div>
      )}

      {(!report.has_website || activeTab === 'maps') && (
        <section>
          <AuditGraph score={report.local_visibility_score ?? -1} />
          <p className="text-center text-gray-600 mt-3 mb-6">Local AI & Maps Pack Score</p>

          <h3 className="font-semibold mb-2">AI Mentions</h3>
          <div className="space-y-3 mb-6">
            {localMentions.length === 0 && (
              <p className="text-sm text-gray-400">No AI mention data available for this audit.</p>
            )}
            {localMentions.map((m) => (
              <div key={m.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium capitalize">{m.source}</p>
                  {mentionBadge(m.mentioned)}
                </div>
                <p className="text-sm text-gray-600 capitalize">Sentiment: {m.sentiment ?? '—'}</p>
              </div>
            ))}
          </div>

          <button className="w-full bg-orange-700 text-white rounded-lg py-3 font-semibold">
            ⚡ Auto-Fix Google Maps Listing — ₹499
          </button>
        </section>
      )}

      {report.has_website && activeTab === 'website' && (
        <section>
          <AuditGraph score={report.visibility_score ?? -1} />
          <p className="text-center text-gray-600 mt-3 mb-6">Website AI Visibility Score</p>

          <h3 className="font-semibold mb-2">AI Mentions & Citations</h3>
          <div className="space-y-3 mb-6">
            {websiteMentions.length === 0 && (
              <p className="text-sm text-gray-400">No AI mention data available for this audit.</p>
            )}
            {websiteMentions.map((m) => (
              <div key={m.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium capitalize">{m.source}</p>
                  {mentionBadge(m.mentioned)}
                </div>
                <p className="text-sm text-gray-600 capitalize mb-2">Sentiment: {m.sentiment ?? '—'}</p>

                <p className="text-xs text-gray-400 mb-1">Citation:</p>
                {m.citation_url ? (
                  <a
                    href={m.citation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 underline break-all"
                  >
                    {m.citation_url}
                  </a>
                ) : (
                  <p className="text-sm text-gray-400">
                    {m.mentioned === true ? 'No specific source link returned by this model' : '—'}
                  </p>
                )}
              </div>
            ))}
          </div>

          <section className="mb-6 space-y-2">
            <h2 className="font-semibold text-lg">Google Search Presence</h2>
            <p className="text-xs text-gray-400 mb-1">
              Google Knowledge Panel / Answer Box में presence — Google का नया "AI Overview" फीचर अभी इस चेक में शामिल नहीं है।
            </p>
            {report.google_results.length === 0 && (
              <p className="text-sm text-gray-400">No search presence data available.</p>
            )}
            {report.google_results.map((g) => (
              <div key={g.id} className="border rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  Query: <span className="font-medium">{g.query}</span>
                </p>
                <p className="text-sm text-gray-600">
                  {g.appears_in_overview ? '✅ Appears in Knowledge Panel/Answer Box' : '❌ Not found'}
                  {g.ranked_position ? ` · Rank #${g.ranked_position}` : ''}
                </p>
                {g.competitor_urls && g.competitor_urls.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-400 mb-1">Top organic results:</p>
                    {g.competitor_urls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 underline break-all block"
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>

          <section>
            <h2 className="font-semibold text-lg mb-2">Fix Issues Automatically</h2>
            {optimizationId ? (
              <FixButton auditId={report.id} optimizationId={optimizationId} />
            ) : (
              <p className="text-sm text-gray-500">
                Connect your WordPress site in Optimizer first to enable auto-fix.
              </p>
            )}
          </section>
        </section>
      )}
    </main>
  );
}