'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import EditProfileSheet from '@/components/EditProfileSheet';
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

  if (!profile) return <main className="p-6">Loading…</main>;

  return (
    <main className="px-6 py-10 max-w-md mx-auto pb-24">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">{profile.full_name}</h1>
        <button
          onClick={() => setShowEditSheet(true)}
          className="text-sm border rounded-lg px-3 py-1.5 font-medium"
        >
          Edit Profile
        </button>
      </div>
      <p className="text-gray-500 mb-6">{profile.brand_name}</p>

      <div className="border rounded-lg p-4 mb-4">
        <p className="text-sm text-gray-500">Website</p>
        <p>{profile.website_url}</p>
      </div>

      <div className="border rounded-lg p-4 mb-6">
        <p className="text-sm text-gray-500">Plan</p>
        <p className="capitalize font-semibold">{profile.plan}</p>
        {profile.plan === 'free' && (
          <button className="mt-2 bg-orange-700 text-white rounded-lg px-4 py-2 text-sm">
            Upgrade to Pro
          </button>
        )}
      </div>

      {audits.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-2">My Audits</h2>
          {audits.map((a) => (
            <button
              key={a.id}
              onClick={() => router.push(`/dashboard?audit=${a.id}`)}
              className="w-full text-left border rounded-lg px-4 py-3 mb-2 hover:bg-gray-50"
            >
              <p className="font-medium">{a.brand_name}</p>
              <p className="text-sm text-gray-500">
                {a.website_url} · Score: {a.visibility_score ?? '—'}
              </p>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={handleLogout}
        className="w-full border border-red-500 text-red-600 rounded-lg py-3 font-semibold"
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