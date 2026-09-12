'use client';

import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { WordpressConnection, Optimization } from '@/types';

export default function OptimizerPage() {
  const [connections, setConnections] = useState<WordpressConnection[]>([]);
  const [optimizations, setOptimizations] = useState<Optimization[]>([]);
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

    const { data: opts } = await supabase
      .from('optimizations')
      .select('*')
      .order('created_at', { ascending: false });
    setOptimizations(opts ?? []);
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
        <h2 className="font-semibold mb-2">Connect WordPress Site</h2>
        <form onSubmit={handleConnect} className="space-y-3">
          <input
            type="url"
            placeholder="https://yoursite.com"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            className="w-full border rounded-lg px-4 py-3"
            required
          />
          <input
            type="text"
            placeholder="WP username"
            value={wpUsername}
            onChange={(e) => setWpUsername(e.target.value)}
            className="w-full border rounded-lg px-4 py-3"
            required
          />
          <input
            type="password"
            placeholder="WP Application Password"
            value={wpAppPassword}
            onChange={(e) => setWpAppPassword(e.target.value)}
            className="w-full border rounded-lg px-4 py-3"
            required
          />
          <button
            type="submit"
            disabled={saving}
            className="bg-black text-white rounded-lg px-5 py-3 font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Connect Site'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Connected Sites</h2>
        {connections.map((c) => (
          <div key={c.id} className="border rounded-lg p-3 mb-2 text-sm">
            {c.site_url}
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="font-semibold mb-2">Fix History</h2>
        {optimizations.map((o) => (
          <div key={o.id} className="border rounded-lg p-3 mb-2 text-sm">
            <p className="capitalize">{o.fix_type.replace('_', ' ')}</p>
            <p className="text-gray-500">{o.status}</p>
          </div>
        ))}
      </section>
    </main>
  );
}