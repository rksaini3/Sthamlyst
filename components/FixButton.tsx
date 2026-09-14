'use client';

import { useState } from 'react';
import { openRazorpayCheckout } from '@/lib/razorpay-client';

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
    try {
      await openRazorpayCheckout({
        amount: 49900,
        description: 'AI Visibility Fix',
        onSuccess: async () => {
          const res = await fetch('/api/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ optimizationId }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || 'Fix could not be applied');
          }
          setMessage('✅ Fix applied to your website!');
        },
      });
    } catch (err: any) {
      setMessage(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
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
