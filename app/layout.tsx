import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/AuthProvider';
import { ThemeProvider } from '@/lib/ThemeProvider';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import SwUpdateWatcher from '@/components/SwUpdateWatcher';
import ConnectivityToast from '@/components/ConnectivityToast';
import AnalyticsConsent from '@/components/AnalyticsConsent';
import PushInit from '@/components/PushInit';
import GlobalHeader from '@/components/GlobalHeader';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'Sthamly — AI Visibility Audit',
  description:
    'Check and fix how ChatGPT, Perplexity, and Google AI Overviews talk about your brand.',
  manifest: '/manifest.json',
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
            <ServiceWorkerRegister />
            <SwUpdateWatcher />
            <ConnectivityToast />
            <AnalyticsConsent />
            <PushInit />
            <GlobalHeader />
            {children}
            <BottomNav />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}