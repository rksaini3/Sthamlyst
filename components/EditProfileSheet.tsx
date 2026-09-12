'use client';

import { useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Profile } from '@/types';

interface Props {
  profile: Profile;
  onClose: () => void;
  onSaved: (updated: Profile) => void;
}

export default function EditProfileSheet({ profile, onClose, onSaved }: Props) {
  const [fullName, setFullName] = useState(profile.full_name ?? '');
  const [brandName, setBrandName] = useState(profile.brand_name ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        brand_name: brandName.trim(),
        website_url: websiteUrl.trim(),
      })
      .eq('id', profile.id)
      .select()
      .single();

    setSaving(false);

    if (error || !data) {
      setError(error?.message || 'Could not save changes');
      return;
    }

    onSaved(data as Profile);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-50">
      <div className="bg-white w-full rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Edit Profile</h2>
          <button onClick={onClose} className="text-gray-500 text-xl">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm text-gray-500">Your name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border rounded-lg px-4 py-3 mt-1"
              required
            />
          </div>

          <div>
            <label className="text-sm text-gray-500">Brand name</label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="e.g. Sthamly"
              className="w-full border rounded-lg px-4 py-3 mt-1"
              required
            />
          </div>

          <div>
            <label className="text-sm text-gray-500">Website URL</label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://yourwebsite.com"
              className="w-full border rounded-lg px-4 py-3 mt-1"
              required
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-black text-white rounded-lg py-3 font-semibold disabled:opacity-50 mt-2"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}