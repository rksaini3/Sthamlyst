'use client';

import { useState } from 'react';
import { openRazorpayCheckout } from '@/lib/razorpay-client';

interface Props {
  auditId: string;
}

export default function FixButton({ auditId }: Props) {
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
            body: JSON.stringify({ auditId, fixType: 'schema_markup' }),
          });
          if (!res.ok) throw new Error('Fix could not be applied');
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
        className="bg-black text-white rounded-lg px-5 py-3 font-semibold disabled:opacity-50"
      >
        {loading ? 'Processing…' : 'Fix Now — ₹499'}
      </button>
      {message && <p className="text-sm mt-2">{message}</p>}
    </div>
  );
}