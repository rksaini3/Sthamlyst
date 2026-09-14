'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [plan, setPlan] = useState<'free' | 'pro'>('free');

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      router.push('/login');
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('full_name, brand_name, website_url, plan')
      .eq('id', userId)
      .single();

    if (data) {
      setFullName(data.full_name || '');
      setBrandName(data.brand_name || '');
      setWebsiteUrl(data.website_url || '');
      setPlan(data.plan || 'free');
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setSaving(false);
      return;
    }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        brand_name: brandName,
        website_url: websiteUrl,
      })
      .eq('id', userId);

    setSaving(false);
    if (updateErr) {
      setError('Settings save nahi ho payi, dobara try karein');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <div className="max-w-md mx-auto pb-24 min-h-dvh">
      <header className="sticky top-0 bg-white/95 backdrop-blur px-4 py-3 border-b border-stone-100 z-10 flex items-center gap-3">
        <Link href="/profile">
          <ArrowLeft size={22} className="text-stone-800" />
        </Link>
        <span className="text-sm font-semibold text-stone-900">Settings</span>
      </header>

      <div className="px-4 pt-5 space-y-6">
        <section>
          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-2">
            Account
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold text-stone-800">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#8B85E3]"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-stone-800">Brand Name</label>
              <input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="e.g. Sthamly"
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#8B85E3]"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-stone-800">Website URL</label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourbrand.com"
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-[#8B85E3]"
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-2">Plan</h2>
          <div className="bg-white border border-stone-200 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-800 capitalize">{plan} Plan</p>
              <p className="text-[11px] text-stone-500">
                {plan === 'free'
                  ? 'Limited audits per month'
                  : 'Unlimited audits + priority fixes'}
              </p>
            </div>
            {plan === 'free' && (
              <button
                onClick={() => router.push('/profile')}
                className="bg-[#8B85E3] text-white rounded-lg px-4 py-2 text-xs font-semibold hover:bg-[#7A73D8] transition-colors"
              >
                Upgrade
              </button>
            )}
          </div>
        </section>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#8B85E3] text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50 hover:bg-[#7A73D8] transition-colors"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Settings'}
        </button>

        <button
          onClick={handleLogout}
          className="w-full border border-red-500 text-red-600 rounded-xl py-3 font-semibold text-sm"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
