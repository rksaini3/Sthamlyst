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
      // NOTE: startCheckout ke andar payment success hone par
      // /api/checkout/verify-payment khud hi call ho jaata hai, jo
      // signature verify karke WordPress pe fix push kar deta hai.
      // Isliye yahan /api/optimize ko dobara call NAHI karna — warna
      // fix WordPress pe do baar apply ho jayega.
      onSuccess: () => {
        setMessage('✅ Fix applied to your website!');
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
