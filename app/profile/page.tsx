'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import EditProfileSheet from '@/components/EditProfileSheet';
import SubscribeButton from '@/components/SubscribeButton';
import type { Profile, Audit } from '@/types';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [showEditSheet, setShowEditSheet] = useState(false);

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

  if (!profile) return <main className="p-6 dark:bg-[#0B0C1A] dark:text-stone-100 min-h-screen">Loading…</main>;

  return (
    <main className="px-6 py-10 max-w-md mx-auto pb-24 bg-white dark:bg-[#0B0C1A] text-stone-900 dark:text-stone-100 min-h-screen">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">{profile.full_name}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditSheet(true)}
            className="text-sm border border-stone-300 dark:border-stone-700 rounded-xl px-3 py-1.5 font-medium"
          >
            Edit Profile
          </button>
          <Link
            href="/settings"
            aria-label="Settings"
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-stone-300 dark:border-stone-700"
          >
            <Settings size={18} />
          </Link>
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
        className="w-full border border-red-500 text-red-600 dark:text-red-400 rounded-xl py-3 font-semibold"
      >
        Log out
      </button>

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