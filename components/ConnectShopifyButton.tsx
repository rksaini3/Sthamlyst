'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ConnectShopifyButton() {
  const [shopDomain, setShopDomain] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    if (!showInput) {
      setShowInput(true);
      return;
    }

    const cleanDomain = shopDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');

    if (!cleanDomain.endsWith('.myshopify.com')) {
      setError('Store domain aisa hona chahiye: mystore.myshopify.com');
      return;
    }
    setError(null);

    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) {
      window.location.href = '/login';
      return;
    }

    const clientId = process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID;
    const redirectUri = `${window.location.origin}/api/shopify/callback`;
    // read/write content = Pages (FAQ push ke liye), script_tags = schema markup inject karne ke liye
    const scopes = 'read_content,write_content,read_script_tags,write_script_tags';

    const url = `https://${cleanDomain}/admin/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(
      scopes
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${userId}`;

    window.location.href = url;
  }

  return (
    <div className="space-y-2">
      {showInput && (
        <input
          type="text"
          value={shopDomain}
          onChange={(e) => setShopDomain(e.target.value)}
          placeholder="mystore.myshopify.com"
          className="w-full border rounded-lg px-3 py-2 text-sm bg-transparent"
        />
      )}
      <button
        onClick={handleConnect}
        className="w-full border rounded-lg py-3 font-semibold flex items-center justify-center gap-2"
      >
        {showInput ? 'Continue to Shopify' : 'Connect Your Shopify Store'}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
