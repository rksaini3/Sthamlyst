'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSending(true);

    const { data: userData } = await supabase.auth.getUser();

    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        userEmail: userData.user?.email ?? 'guest',
        page: window.location.href,
      }),
    });

    setSending(false);
    setSent(true);
    setText('');
    setTimeout(() => {
      setSent(false);
      setOpen(false);
    }, 1500);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
      >
        💡 Share Your Thoughts
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-stone-900 rounded-t-2xl sm:rounded-2xl p-5 w-full sm:w-96 max-w-full">
            {sent ? (
              <p className="text-center text-green-600 dark:text-green-400 py-6">✅ Bhej diya, dhanyawad!</p>
            ) : (
              <>
                <h3 className="font-semibold mb-3 text-stone-900 dark:text-stone-100">Share Your Thoughts</h3>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Koi problem hai ya suggestion? Yahan likho..."
                  rows={4}
                  className="w-full border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B85E3]"
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setOpen(false)}
                    className="flex-1 border border-stone-300 dark:border-stone-700 rounded-xl py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={sending || !text.trim()}
                    className="flex-1 bg-[#8B85E3] text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
