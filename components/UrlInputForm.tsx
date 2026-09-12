'use client';

import { useState } from 'react';

interface Props {
  onSubmit: (data: { brandName: string; city: string; websiteUrl: string }) => void;
  loading: boolean;
}

export default function UrlInputForm({ onSubmit, loading }: Props) {
  const [brandName, setBrandName] = useState('');
  const [city, setCity] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brandName.trim() || !city.trim()) return;
    onSubmit({ brandName: brandName.trim(), city: city.trim(), websiteUrl: websiteUrl.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3">
      <input
        type="text"
        placeholder="Business Name"
        value={brandName}
        onChange={(e) => setBrandName(e.target.value)}
        required
        className="w-full border rounded-lg px-4 py-3"
      />
      <input
        type="text"
        placeholder="Target Location / City"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        required
        className="w-full border rounded-lg px-4 py-3"
      />
      <input
        type="url"
        placeholder="Website URL (optional)"
        value={websiteUrl}
        onChange={(e) => setWebsiteUrl(e.target.value)}
        className="w-full border rounded-lg px-4 py-3"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-orange-700 text-white rounded-lg py-3 font-semibold disabled:opacity-50"
      >
        {loading ? 'Auditing…' : 'Run Free Audit'}
      </button>
    </form>
  );
}