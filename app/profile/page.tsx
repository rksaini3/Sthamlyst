'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { Profile } from '@/types';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

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
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (!profile) return <main className="p-6">Loading…</main>;

  return (
    <main className="px-6 py-10 max-w-md mx-auto pb-24">
      <h1 className="text-2xl font-bold mb-1">{profile.full_name}</h1>
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

      <button
        onClick={handleLogout}
        className="w-full border border-red-500 text-red-600 rounded-lg py-3 font-semibold"
      >
        Log out
      </button>
    </main>
  );
}