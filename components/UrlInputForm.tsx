'use client';

import { useState, FormEvent } from 'react';

interface Props {
  onSubmit: (websiteUrl: string, brandName: string) => void;
  loading: boolean;
}

export default function UrlInputForm({ onSubmit, loading }: Props) {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [brandName, setBrandName] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!websiteUrl.trim() || !brandName.trim()) return;
    onSubmit(websiteUrl.trim(), brandName.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3">
      <input
        type="text"
        placeholder="Brand name (e.g. Sthamly)"
        value={brandName}
        onChange={(e) => setBrandName(e.target.value)}
        className="w-full border rounded-lg px-4 py-3 text-base"
        required
      />
      <input
        type="url"
        placeholder="https://yourwebsite.com"
        value={websiteUrl}
        onChange={(e) => setWebsiteUrl(e.target.value)}
        className="w-full border rounded-lg px-4 py-3 text-base"
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-black text-white rounded-lg py-3 font-semibold disabled:opacity-50"
      >
        {loading ? 'Running audit…' : 'Run Free Audit'}
      </button>
    </form>
  );
}