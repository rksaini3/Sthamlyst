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

export const metadata: Metadata = {
  title: 'Sthamly — AI Visibility Audit',
  description:
    'Check and fix how ChatGPT, Perplexity, and Google AI Overviews talk about your brand.',
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
  return (
    <html lang="en">
      <body>
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
