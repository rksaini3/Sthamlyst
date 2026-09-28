import type { Metadata } from 'next';
import HomeClient from '@/components/HomeClient';

// Yeh ab SERVER COMPONENT hai ('use client' hata diya) — H1/subtitle ka
// asli text ab server-rendered HTML mein directly aata hai, JS load hone
// ka wait nahi karna padta. Isse Google, Bing, aur ChatGPT/Perplexity jaise
// AI crawlers (jo aksar JS run nahi karte) ko bhi turant real content milega —
// jo iss product ke liye khaas zaroori hai (yeh khud AI-visibility bechta hai).
//
// Note: H1/subtitle yahan hamesha English mein hain (default language). Poori
// app ke andar ka baaki UI (form, buttons, history) HomeClient.tsx mein hai
// aur Hindi/English dono support karta hai jaisa pehle karta tha.
export const metadata: Metadata = {
  title: 'Is your brand visible in AI search?',
  description:
    'Check how ChatGPT, Gemini, Perplexity, and Google AI Overviews / Maps talk about your business — free AI visibility audit.',
};

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16 bg-white dark:bg-[#0B0C1A] text-stone-900 dark:text-stone-100">
      <h1 className="text-3xl font-bold text-center mb-3">Is your brand visible in AI search?</h1>
      <p className="text-stone-600 dark:text-stone-400 text-center max-w-md mb-8">
        Check how ChatGPT, Gemini, Perplexity, and Google AI Overviews / Maps talk about your business — free.
      </p>

      <HomeClient />
    </main>
  );
}
