'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import UrlInputForm from '@/components/UrlInputForm';

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStartAudit(websiteUrl: string, brandName: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl, brandName }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Audit could not be started');
      }

      const { auditId } = await res.json();
      router.push(`/dashboard?audit=${auditId}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-white">
      <h1 className="text-3xl font-bold text-center mb-3">
        Is your brand visible in AI search?
      </h1>
      <p className="text-gray-600 text-center max-w-md mb-8">
        Check how ChatGPT, Perplexity, and Google AI Overviews talk about your
        brand — free.
      </p>

      <UrlInputForm onSubmit={handleStartAudit} loading={loading} />

      {error && <p className="text-red-600 mt-4 text-sm">{error}</p>}
    </main>
  );
}