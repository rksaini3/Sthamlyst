'use client';

import { useState } from 'react';
import { loadRazorpayScript } from '@/lib/razorpay-client';
import { supabase } from '@/lib/supabaseClient';

export default function SubscribeButton() {
  const [loading, setLoading] = useState(false);

  async function handleSubscribe() {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        window.location.href = '/login';
        return;
      }

      const res = await fetch('/api/checkout/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const { subscriptionId, keyId } = await res.json();

      await loadRazorpayScript();

      const options = {
        key: keyId,
        subscription_id: subscriptionId,
        name: 'Sthamly Pro',
        description: '₹999/month — Auto AI Visibility Fixes',
        handler: function () {
          window.location.href = '/profile?subscribed=1';
        },
        theme: { color: '#c2410c' },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleSubscribe}
      disabled={loading}
      className="mt-2 bg-orange-700 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
    >
      {loading ? 'Please wait…' : 'Upgrade to Pro — ₹999/month'}
    </button>
  );
}