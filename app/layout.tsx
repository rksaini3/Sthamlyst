import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/AuthProvider';
import { ThemeProvider } from '@/lib/ThemeProvider';
import { LanguageProvider } from '@/lib/LanguageProvider';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import SwUpdateWatcher from '@/components/SwUpdateWatcher';
import ConnectivityToast from '@/components/ConnectivityToast';
import AnalyticsConsent from '@/components/AnalyticsConsent';
import { PushInit } from '@/components/PushInit';
import GlobalHeader from '@/components/GlobalHeader';
import BottomNav from '@/components/BottomNav';

const BASE_URL = 'https://www.sthamly.com';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Sthamly — AI Visibility Audit & Auto-Fix for Agencies',
    template: '%s | Sthamly',
  },
  description:
    'Sthamly is an AI-visibility audit and auto-fix SaaS tool. Check and fix how ChatGPT, Perplexity, and Google AI Overviews talk about your brand, then deliver a client-ready report as an agency.',
  alternates: {
    canonical: '/',
  },
  keywords: [
    'AI visibility audit',
    'ChatGPT SEO',
    'AI overview optimization',
    'agency AI-fix tool',
    'Sthamly',
  ],
  openGraph: {
    type: 'website',
    url: BASE_URL,
    siteName: 'Sthamly',
    title: 'Sthamly — AI Visibility Audit & Auto-Fix for Agencies',
    description:
      'Check and fix how ChatGPT, Perplexity, and Google AI Overviews talk about your brand.',
  },
  manifest: '/manifest.json',
  icons: {
    // Order matters: SVG pehle (modern browsers isko prefer karte hain,
    // infinitely scalable, dark/light dono mein crisp dikhta hai),
    // ICO/PNG fallback purane browsers aur jagah jahan SVG support nahi.
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Sthamly',
    url: BASE_URL,
    logo: `${BASE_URL}/icon-512.png`,
    description:
      'Sthamly is an AI-visibility audit and auto-fix SaaS tool that helps agencies and small businesses check and fix how ChatGPT, Perplexity, and Google AI Overviews describe their brand.',
    sameAs: [
      // TODO: yahan LinkedIn / X / Instagram jaise official social profile links daalo
      // — ye Google ko confirm karta hai ki ye sab ek hi entity ke handles hain.
    ],
  };

  return (
    <html lang="en">
      <body>
        {/* Organization schema — AI aur Google ko batata hai Sthamly kya hai,
            taaki flower-delivery jaisi doosri "Sthamly" entities se confuse na ho. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              <ServiceWorkerRegister />
              <SwUpdateWatcher />
              <ConnectivityToast />
              <AnalyticsConsent />
              <PushInit />
              <GlobalHeader />
              {children}
              <BottomNav />
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
