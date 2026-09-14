'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ConnectGBPButton from '@/components/ConnectGBPButton';
import type { WordpressConnection, Optimization, Audit } from '@/types';

interface OptimizationWithAudit extends Optimization {
  audits: Pick<Audit, 'brand_name' | 'visibility_score'> | null;
}

function getDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

export default function OptimizerPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<WordpressConnection[]>([]);
  const [optimizations, setOptimizations] = useState<OptimizationWithAudit[]>([]);
  const [siteScores, setSiteScores] = useState<Record<string, { brand: string; score: number | null }>>({});
  const [gbpConnected, setGbpConnected] = useState(false);
  const [siteUrl, setSiteUrl] = useState('');
  const [wpUsername, setWpUsername] = useState('');
  const [wpAppPassword, setWpAppPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const { data: conns } = await supabase
      .from('wordpress_connections')
      .select('*')
      .eq('user_id', userId);
    setConnections(conns ?? []);

    const { data: gbp } = await supabase
      .from('gbp_connections')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    setGbpConnected(!!gbp);

    const { data: opts } = await supabase
      .from('optimizations')
      .select('*, audits(brand_name, visibility_score)')
      .order('created_at', { ascending: false });
    setOptimizations((opts as any) ?? []);

    if (conns && conns.length > 0) {
      const { data: audits } = await supabase
        .from('audits')
        .select('brand_name, website_url, visibility_score, created_at')
        .eq('user_id', userId)
        .eq('has_website', true)
        .order('created_at', { ascending: false });

      const scoreMap: Record<string, { brand: string; score: number | null }> = {};
      conns.forEach((c) => {
        const domain = getDomain(c.site_url);
        const match = (audits ?? []).find((a) => getDomain(a.website_url) === domain);
        if (match) {
          scoreMap[c.id] = { brand: match.brand_name, score: match.visibility_score };
        }
      });
      setSiteScores(scoreMap);
    }
  }

  async function handleConnect(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    await supabase.from('wordpress_connections').insert({
      user_id: userId,
      site_url: siteUrl,
      wp_username: wpUsername,
      wp_app_password: wpAppPassword,
    });

    setSiteUrl('');
    setWpUsername('');
    setWpAppPassword('');
    setSaving(false);
    loadData();
  }

  return (
    <main className="px-6 py-10 max-w-2xl mx-auto pb-24">
      <h1 className="text-2xl font-bold mb-6">Optimizer</h1>

      <section className="mb-8">
        <h2 className="font-semibold mb-2">Google Business Profile</h2>
        {gbpConnected ? (
          <div className="border rounded-lg p-4 text-sm text-green-700 bg-green-50">
            ✅ Google Business Profile connected
          </div>
        ) : (
          <ConnectGBPButton />
        )}
      </section>

      <section className="mb-8">
        <h2 className="font-semibold mb-2">Connect WordPress Site</h2>
        <form onSubmit={handleConnect} className="space-y-3">
          <input
            type="url"
            placeholder="https://yoursite.com"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8B85E3]"
            required
          />
          <input
            type="text"
            placeholder="WP username"
            value={wpUsername}
            onChange={(e) => setWpUsername(e.target.value)}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8B85E3]"
            required
          />
          <input
            type="password"
            placeholder="WP Application Password"
            value={wpAppPassword}
            onChange={(e) => setWpAppPassword(e.target.value)}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8B85E3]"
            required
          />
          <button
            type="submit"
            disabled={saving}
            className="bg-[#8B85E3] text-white rounded-lg px-5 py-3 font-semibold disabled:opacity-50 hover:bg-[#7A73D8] transition-colors"
          >
            {saving ? 'Saving…' : 'Connect Site'}
          </button>
        </form>
      </section>

      <section className="mb-8">
        <h2 className="font-semibold mb-2">Connected Sites</h2>
        {connections.length === 0 && (
          <p className="text-sm text-gray-400">No sites connected yet.</p>
        )}
        {connections.map((c) => {
          const scoreInfo = siteScores[c.id];
          return (
            <div key={c.id} className="border rounded-lg p-4 mb-2">
              <p className="text-sm font-medium">{c.site_url}</p>
              {scoreInfo ? (
                <p className="text-xs text-gray-500 mt-1">
                  Latest audit: <span className="font-medium">{scoreInfo.brand}</span> · Score:{' '}
                  <span className="font-semibold">{scoreInfo.score ?? '—'}</span>
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-1">Is site ke liye abhi tak koi audit nahi chala</p>
              )}
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Fix History</h2>
        {optimizations.length === 0 && (
          <p className="text-sm text-gray-400">No fixes attempted yet.</p>
        )}
        {optimizations.map((o) => (
          <button
            key={o.id}
            onClick={() => router.push(`/dashboard?audit=${o.audit_id}`)}
            className="w-full text-left border rounded-lg p-3 mb-2 text-sm hover:bg-gray-50"
          >
            <p className="capitalize font-medium">
              {o.fix_type.replace('_', ' ')} — {o.audits?.brand_name ?? 'Unknown brand'}
            </p>
            <p className="text-gray-500">
              {o.status} · Payment: {o.payment_status}
            </p>
          </button>
        ))}
      </section>
    </main>
  );
}
