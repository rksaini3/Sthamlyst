'use client';

import { useState } from 'react';
import { loadRazorpayScript, startCheckout } from '@/lib/razorpay-client';
import { useIntroPrice } from '@/lib/useIntroPrice';

interface Props {
  auditId: string;
  optimizationId: string;
  onApplied?: () => void;
}

export default function FixButton({ auditId, optimizationId, onApplied }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { amountLabel } = useIntroPrice();

  async function handleFixNow() {
    setLoading(true);
    setMessage(null);

    try {
      await loadRazorpayScript();
      await startCheckout({
        sthamlyOrderIds: [optimizationId],
        // NOTE: startCheckout ke andar payment success hone par
        // /api/checkout/verify-payment khud hi call ho jaata hai, jo
        // signature verify karke WordPress/Shopify pe fix push kar deta hai,
        // aur agar yeh intro price thi toh profile.intro_price_used bhi
        // wahi set kar deta hai. Isliye yahan /api/optimize dobara call NAHI karna.
        onSuccess: () => {
          setMessage('✅ Fix applied to your website!');
          setLoading(false);
          if (onApplied) onApplied();
        },
        onFailure: (msg: any) => {
          setMessage(typeof msg === 'string' ? msg : 'Payment failed');
          setLoading(false);
        },
      });
    } catch (err: any) {
      setMessage(err?.message || 'Something went wrong — please try again');
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleFixNow}
        disabled={loading}
        className="bg-[#8B85E3] text-white rounded-xl px-5 py-3 font-semibold disabled:opacity-50 hover:bg-[#7A73D8] transition-colors"
      >
        {loading ? 'Processing…' : `Fix Now — ${amountLabel}`}
      </button>
      {message && <p className="text-sm mt-2 text-stone-700 dark:text-stone-300">{message}</p>}
    </div>
  );
}
