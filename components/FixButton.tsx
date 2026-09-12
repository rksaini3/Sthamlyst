'use client';

import { useState } from 'react';
import { loadRazorpayScript, startCheckout } from '@/lib/razorpay-client';

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
      await loadRazorpayScript();
      await startCheckout({
        sthamlyOrderIds: [optimizationId],
        onSuccess: () => {
          setMessage('✅ Fix applied to your website!');
        },
        onFailure: (err: any) => {
          setMessage(err?.message || 'Payment failed');
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
        className="w-full bg-black text-white rounded-lg py-3 font-semibold disabled:opacity-50"
      >
        {loading ? 'Processing…' : 'Fix Now — ₹499'}
      </button>
      {message && <p className="text-sm mt-2">{message}</p>}
    </div>
  );
}