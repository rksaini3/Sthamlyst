'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import EditProfileSheet from '@/components/EditProfileSheet';
import SubscribeButton from '@/components/SubscribeButton';
import type { Profile, Audit } from '@/types';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      router.push('/login');
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);

    const { data: auditRows } = await supabase
      .from('audits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setAudits(auditRows ?? []);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDeleteError(body.error || 'Account delete nahi ho paya');
      setDeleting(false);
      return;
    }

    await supabase.auth.signOut();
    router.push('/');
  }

  if (!profile) return <main className="p-6 dark:bg-[#0B0C1A] dark:text-stone-100 min-h-screen">Loading…</main>;

  return (
    <main className="px-6 py-10 max-w-md mx-auto pb-24 bg-white dark:bg-[#0B0C1A] text-stone-900 dark:text-stone-100 min-h-screen relative">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">{profile.full_name}</h1>
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setShowEditSheet(true)}
            className="text-sm border border-stone-300 dark:border-stone-700 rounded-xl px-3 py-1.5 font-medium"
          >
            Edit Profile
          </button>

          {/* Hamburger menu button */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            aria-label="Menu"
            className="w-9 h-9 flex items-center justify-center rounded-full border border-stone-300 dark:border-stone-700"
          >
            <span className="text-lg leading-none">☰</span>
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <>
              {/* Backdrop — bahar tap karne se menu band ho jaye */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-11 z-20 w-48 bg-white dark:bg-[#14162E] border border-stone-200 dark:border-stone-700 rounded-xl shadow-lg py-1">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    router.push('/settings');
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-800"
                >
                  ⚙️ Settings
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    router.push('/optimizer');
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-800"
                >
                  🔌 Optimizer
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    router.push('/privacy');
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-800"
                >
                  🔒 Privacy Policy
                </button>
                <div className="border-t border-stone-200 dark:border-stone-700 my-1" />
                <button
                  onClick={() => {
                    setShowMenu(false);
                    handleLogout();
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-stone-50 dark:hover:bg-stone-800"
                >
                  🚪 Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <p className="text-stone-500 dark:text-stone-400 mb-6">{profile.brand_name}</p>

      <div className="border border-stone-200 dark:border-stone-800 rounded-xl p-4 mb-4">
        <p className="text-sm text-stone-500 dark:text-stone-400">Website</p>
        <p>{profile.website_url}</p>
      </div>

      <div className="border border-stone-200 dark:border-stone-800 rounded-xl p-4 mb-6">
        <p className="text-sm text-stone-500 dark:text-stone-400">Plan</p>
        <p className="capitalize font-semibold">{profile.plan}</p>
        {profile.plan === 'free' && <SubscribeButton />}
      </div>

      {audits.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-2">My Audits</h2>
          {audits.map((a) => (
            <button
              key={a.id}
              onClick={() => router.push(`/dashboard?audit=${a.id}`)}
              className="w-full text-left border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-3 mb-2 hover:bg-stone-50 dark:hover:bg-stone-800/50"
            >
              <p className="font-medium">{a.brand_name}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {a.target_city}
                {a.has_website ? ` · Website Score: ${a.visibility_score ?? '—'}` : ''}
                {' · Local Score: '}
                {a.local_visibility_score ?? '—'}
              </p>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={handleLogout}
        className="w-full border border-red-500 text-red-600 dark:text-red-400 rounded-xl py-3 font-semibold mb-3"
      >
        Log out
      </button>

      {!showDeleteConfirm ? (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full text-sm text-red-500 dark:text-red-400 underline py-2"
        >
          Delete Account
        </button>
      ) : (
        <div className="border border-red-300 dark:border-red-900 rounded-xl p-4 bg-red-50 dark:bg-red-900/10">
          <p className="text-sm text-red-700 dark:text-red-400 font-medium mb-1">
            Pakka delete karna hai?
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
            Yeh permanent hai — aapke saare audits, WordPress connections, aur account data hamesha ke liye delete ho jayenge.
          </p>
          {deleteError && <p className="text-red-600 text-sm mb-2">{deleteError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Haan, delete karein'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
              className="flex-1 border border-stone-300 dark:border-stone-700 rounded-xl py-2 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showEditSheet && (
        <EditProfileSheet
          profile={profile}
          onClose={() => setShowEditSheet(false)}
          onSaved={(updated) => setProfile(updated)}
        />
      )}
    </main>
  );
}
