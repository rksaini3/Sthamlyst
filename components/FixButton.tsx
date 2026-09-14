'use client';

import { useState } from 'react';
import { startCheckout } from '@/lib/razorpay-client';

interface Props {
  auditId: string;
  optimizationId: string;
}

export default function FixButton({ auditId, optimizationId }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFixNow() {
    setLoading(true);
    setMessage(null);

    await startCheckout({
      // NOTE: 'sthamlyOrderIds' Bazaar marketplace orders ke liye bana tha.
      // Yahan optimizationId bhej rahe hain — ye tabhi kaam karega jab
      // /api/checkout/create-order isko 'optimizations' table mein bhi
      // dhoondhna jaanta ho. Agar wo sirf Bazaar 'orders' table check
      // karta hai, to ye fail hoga — us route ka code dekhna padega.
      sthamlyOrderIds: [optimizationId],
      onSuccess: async () => {
        const res = await fetch('/api/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ optimizationId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setMessage(body.error || 'Fix could not be applied');
        } else {
          setMessage('✅ Fix applied to your website!');
        }
        setLoading(false);
      },
      onFailure: (msg) => {
        setMessage(msg);
        setLoading(false);
      },
    });
  }

  return (
    <div>
      <button
        onClick={handleFixNow}
        disabled={loading}
        className="bg-[#8B85E3] text-white rounded-lg px-5 py-3 font-semibold disabled:opacity-50 hover:bg-[#7A73D8] transition-colors"
      >
        {loading ? 'Processing…' : 'Fix Now — ₹499'}
      </button>
      {message && <p className="text-sm mt-2">{message}</p>}
    </div>
  );
}
