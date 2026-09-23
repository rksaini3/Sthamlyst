'use client';

import { useState, FormEvent } from 'react';

interface Props {
  onSubmit: (data: { brandName: string; city: string; websiteUrl: string }) => void;
  loading: boolean;
}

// "www.zomato.com" ya "zomato.com" jaisa likha ho to https:// khud jod deta hai,
// taaki user ko har baar http/https likhne ki zaroorat na pade.
function normalizeUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value.replace(/^\/+/, '')}`;
}

export default function UrlInputForm({ onSubmit, loading }: Props) {
  const [brandName, setBrandName] = useState('');
  const [city, setCity] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!brandName.trim() || !city.trim()) return;

    const normalized = normalizeUrl(websiteUrl);
    if (normalized) {
      try {
        new URL(normalized);
      } catch {
        setUrlError('Website URL sahi format mein nahi hai — jaise www.zomato.com');
        return;
      }
    }
    setUrlError(null);

    onSubmit({
      brandName: brandName.trim(),
      city: city.trim(),
      websiteUrl: normalized,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3">
      <input
        type="text"
        placeholder="Business Name"
        value={brandName}
        onChange={(e) => setBrandName(e.target.value)}
        className="w-full border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#14162E] text-stone-900 dark:text-stone-100 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#8B85E3]"
        required
      />
      <input
        type="text"
        placeholder="Target Location / City"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        className="w-full border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#14162E] text-stone-900 dark:text-stone-100 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#8B85E3]"
        required
      />
      <div>
        <input
          type="text"
          placeholder="Website URL (optional) — jaise www.zomato.com"
          value={websiteUrl}
          onChange={(e) => {
            setWebsiteUrl(e.target.value);
            if (urlError) setUrlError(null);
          }}
          className="w-full border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#14162E] text-stone-900 dark:text-stone-100 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#8B85E3]"
        />
        {urlError && <p className="text-xs text-red-500 mt-1">{urlError}</p>}
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#8B85E3] hover:bg-[#7A73D8] transition-colors text-white rounded-xl py-3 font-semibold disabled:opacity-50"
      >
        {loading ? 'Auditing…' : 'Run Free Audit'}
      </button>
    </form>
  );
}
