'use client';

import { useState } from 'react';
import { loadRazorpayScript } from '@/lib/razorpay-client';
import { supabase } from '@/lib/supabaseClient';

export default function SubscribeButton() {
  const [loading, setLoading] = useState(false);

  function openSubscriptionCheckout(subscriptionId: string, keyId: string) {
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
  }

  async function handleSubscribe() {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        window.location.href = '/login';
        return;
      }

      await loadRazorpayScript();

      const res = await fetch('/api/checkout/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();

      // Case A: intro pehle use ho chuka — seedha subscription checkout khulega
      if (!data.requiresIntroPayment) {
        openSubscriptionCheckout(data.subscriptionId, data.keyId);
        return;
      }

      // Case B: pehle ₹1 charge karna hai
      const introOptions = {
        key: data.keyId,
        order_id: data.razorpayOrderId,
        amount: data.amount,
        currency: 'INR',
        name: 'Sthamly Pro — Intro Offer',
        description: '₹1 aaj, phir 1 mahina free, uske baad ₹999/month',
        handler: async function (introResponse: any) {
          // ₹1 confirm hone ke baad, subscription activate karo (1 month free ke saath)
          const activateRes = await fetch('/api/checkout/activate-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              razorpay_order_id: introResponse.razorpay_order_id,
              razorpay_payment_id: introResponse.razorpay_payment_id,
              razorpay_signature: introResponse.razorpay_signature,
            }),
          });
          const activateData = await activateRes.json();

          if (activateData.subscriptionId) {
            openSubscriptionCheckout(activateData.subscriptionId, activateData.keyId);
          } else {
            alert(activateData.error || 'Subscription activate nahi ho payi, dobara try karein.');
          }
        },
        theme: { color: '#c2410c' },
      };
      const rzp = new (window as any).Razorpay(introOptions);
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
      {loading ? 'Please wait…' : 'Upgrade to Pro — ₹1 aaj, phir ₹999/month'}
    </button>
  );
}
