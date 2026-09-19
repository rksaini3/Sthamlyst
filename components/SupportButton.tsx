'use client';

import { MessageCircle } from 'lucide-react';

// Apna WhatsApp Business number yahan daalo (country code ke saath, bina + ya spaces ke)
const WHATSAPP_NUMBER = '91XXXXXXXXXX';

export default function SupportButton() {
  function openWhatsApp() {
    const message = encodeURIComponent('Hi Sthamly team, mujhe help chahiye — ');
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
  }

  return (
    <button
      onClick={openWhatsApp}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
    >
      <MessageCircle size={16} />
      Help & Support
    </button>
  );
}
