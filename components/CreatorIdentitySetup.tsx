'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024 // 5MB

export default function CreatorIdentitySetup({
  onClose, onSaved,
}: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth()
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Fix: build the object URL once per file (not once per render) and
  // revoke it on cleanup / when a new file is chosen, to avoid leaking
  // blob URLs on every re-render (e.g. while typing the bio).
  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null)
      return
    }
    const url = URL.createObjectURL(avatarFile)
    setAvatarPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [avatarFile])

  function handleAvatarChange(file: File | null) {
    setError('')
    if (!file) {
      setAvatarFile(null)
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Sirf image file select karo.')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Photo 5MB se chhoti honi chahiye.')
      return
    }
    setAvatarFile(file)
  }

  async function handleSave() {
    setError('')

    const cleanUsername = username.trim()
    if (!cleanUsername || cleanUsername.length < 3) {
      setError('Handle kam se kam 3 letters ka hona chahiye.')
      return
    }
    // Fix: restrict to characters safe for use in a URL path
    // (/creator/[username]) — previously only spaces were stripped, so
    // things like "/" or "?" could slip through and break profile links.
    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      setError('Handle mein sirf lowercase letters, numbers aur underscore allowed hain.')
      return
    }
    if (!user) return
    setSaving(true)

    let avatarUrl: string | null = null
    if (avatarFile) {
      const filePath = `${user.id}/${Date.now()}-${avatarFile.name}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile)
      if (uploadError) {
        // Fix: surface the failure instead of silently saving without
        // the photo — previously the user had no way to know their
        // avatar didn't actually get attached.
        setSaving(false)
        setError('Photo upload nahi ho paayi: ' + uploadError.message + ' — dobara try karo.')
        return
      }
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      avatarUrl = data.publicUrl
    }

    const { error: rpcError } = await supabase.rpc('update_creator_identity', {
      p_username: cleanUsername,
      p_bio: bio || null,
      p_avatar_url: avatarUrl,
    })

    setSaving(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center px-6">
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 w-full max-w-sm">
        <h2 className="font-heading font-semibold text-lg text-clay">Set Up Your Creator Profile</h2>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 mb-4">
          Warna aapka profile khaali dikhega — bas 3 cheezein set kar do.
        </p>

        <div className="space-y-3">
          <div className="flex justify-center">
            <label className="w-16 h-16 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-2xl cursor-pointer overflow-hidden">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
              ) : '📷'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleAvatarChange(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">@Handle</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="mrs_sharma_clay"
              className="w-full border border-stone-300 dark:border-stone-700 dark:bg-stone-800 rounded-xl px-3 py-2 text-sm mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">Bio (optional)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Gonda mein 15 saal se clay diyas banati hoon"
              rows={2}
              className="w-full border border-stone-300 dark:border-stone-700 dark:bg-stone-800 rounded-xl px-3 py-2 text-sm mt-1"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 py-2.5 rounded-xl text-sm">
            Baad mein
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-clay text-white py-2.5 rounded-xl text-sm disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
