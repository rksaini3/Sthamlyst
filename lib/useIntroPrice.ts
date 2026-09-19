'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Return karta hai: kya user pehli baar hai (₹1) ya regular (₹99)
export function useIntroPrice() {
  const [amountLabel, setAmountLabel] = useState('…'); // load hone tak placeholder
  const [amountPaise, setAmountPaise] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        if (mounted) {
          setAmountLabel('₹1');
          setAmountPaise(100);
        }
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('intro_price_used')
        .eq('id', userId)
        .single();

      if (!mounted) return;

      if (profile?.intro_price_used) {
        setAmountLabel('₹99');
        setAmountPaise(9900);
      } else {
        setAmountLabel('₹1');
        setAmountPaise(100);
      }
    }

    check();
    return () => {
      mounted = false;
    };
  }, []);

  return { amountLabel, amountPaise };
}
