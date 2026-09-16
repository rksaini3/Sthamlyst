'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/lib/LanguageProvider';
import UrlInputForm from '@/components/UrlInputForm';
import {
  addAuditToHistory,
  getAuditHistory,
  removeAuditFromHistory,
  clearAuditHistory,
  type AuditHistoryEntry,
} from '@/lib/auditHistory';

export default function HomePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AuditHistoryEntry[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [editMode, setEditMode] = useState(false);

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

  function handleRemoveEntry(auditId: string) {
    removeAuditFromHistory(auditId);
    const updated = getAuditHistory();
    setHistory(updated);
    if (updated.length === 0) setEditMode(false);
  }

  function handleClearAll() {
    clearAuditHistory();
    setHistory([]);
    setEditMode(false);
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16 bg-white dark:bg-[#0B0C1A] text-stone-900 dark:text-stone-100">
      {!isLoggedIn && (
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
          <a href="/login" className="underline text-[#8B85E3]">{t('home.loginLink')}</a> {t('home.loginPrompt')}
        </p>
      )}

      <h1 className="text-3xl font-bold text-center mb-3">{t('home.title')}</h1>
      <p className="text-stone-600 dark:text-stone-400 text-center max-w-md mb-8">{t('home.subtitle')}</p>

      <UrlInputForm onSubmit={handleStartAudit} loading={loading} />

      {error && <p className="text-red-600 mt-4 text-sm">{error}</p>}

      {history.length > 0 && (
        <section className="w-full max-w-md mt-12">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">{t('home.recentAudits')}</h2>
            <button onClick={() => setEditMode(!editMode)} className="text-sm text-[#8B85E3] font-medium">
              {editMode ? t('home.done') : t('home.edit')}
            </button>
          </div>

          <div className="space-y-2">
            {history.map((entry) => (
              <div key={entry.auditId} className="flex items-center gap-2">
                {editMode && (
                  <button
                    onClick={() => handleRemoveEntry(entry.auditId)}
                    aria-label="Delete this audit from history"
                    className="flex-shrink-0 w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold flex items-center justify-center"
                  >
                    ✕
                  </button>
                )}
                <button
                  onClick={() => !editMode && router.push(`/dashboard?audit=${entry.auditId}`)}
                  disabled={editMode}
                  className="flex-1 text-left border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 disabled:hover:bg-transparent"
                >
                  <p className="font-medium">{entry.brandName}</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{entry.websiteUrl}</p>
                </button>
              </div>
            ))}
          </div>

          {editMode && (
            <button
              onClick={handleClearAll}
              className="w-full mt-3 text-sm text-red-600 dark:text-red-400 font-medium border border-red-200 dark:border-red-900 rounded-xl py-2"
            >
              {t('home.clearAll')}
            </button>
          )}
        </section>
      )}
    </main>
  );
}