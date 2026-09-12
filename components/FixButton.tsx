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
      sthamlyOrderIds: [optimizationId],
      onSuccess: () => {
        setLoading(false);
        setMessage('✅ Payment done — fix is being applied to your website!');
      },
      onFailure: (msg) => {
        setLoading(false);
        setMessage(msg);
      },
    });
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