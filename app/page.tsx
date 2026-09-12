'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import UrlInputForm from '@/components/UrlInputForm';
import { addAuditToHistory, getAuditHistory, type AuditHistoryEntry } from '@/lib/auditHistory';

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AuditHistoryEntry[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setHistory(getAuditHistory());
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
  }, []);

  async function handleStartAudit(data: { brandName: string; city: string; websiteUrl: string }) {
    setLoading(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Audit could not be started');
      }

      const { auditId } = await res.json();

      addAuditToHistory({
        auditId,
        brandName: data.brandName,
        websiteUrl: data.websiteUrl || data.city,
        createdAt: new Date().toISOString(),
      });

      router.push(`/dashboard?audit=${auditId}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16 bg-white">
      {!isLoggedIn && (
        <p className="text-sm text-gray-500 mb-4">
          <a href="/login" className="underline">Log in</a> to save your audits permanently across devices
        </p>
      )}

      <h1 className="text-3xl font-bold text-center mb-3">
        Is your brand visible in AI search?
      </h1>
      <p className="text-gray-600 text-center max-w-md mb-8">
        Check how ChatGPT, Gemini, Perplexity, and Google AI Overviews / Maps
        talk about your business — free.
      </p>

      <UrlInputForm onSubmit={handleStartAudit} loading={loading} />

      {error && <p className="text-red-600 mt-4 text-sm">{error}</p>}

      {history.length > 0 && (
        <section className="w-full max-w-md mt-12">
          <h2 className="font-semibold text-lg mb-3">Recent Audits (this device)</h2>
          <div className="space-y-2">
            {history.map((entry) => (
              <button
                key={entry.auditId}
                onClick={() => router.push(`/dashboard?audit=${entry.auditId}`)}
                className="w-full text-left border rounded-lg px-4 py-3 hover:bg-gray-50"
              >
                <p className="font-medium">{entry.brandName}</p>
                <p className="text-sm text-gray-500">{entry.websiteUrl}</p>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}