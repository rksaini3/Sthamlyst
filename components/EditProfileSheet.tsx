'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

type ProfileFields = {
  full_name: string | null
  username: string | null
  bio: string | null
  city: string | null
  avatar_url: string | null
  is_private: boolean
  pronouns: string | null
  gender: string | null
}

export default function EditProfileSheet({
  profile,
  onClose,
  onSaved,
}: {
  profile: ProfileFields
  onClose: () => void
  onSaved: () => void
}) {
  const { user } = useAuth()
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [username, setUsername] = useState(profile.username || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [city, setCity] = useState(profile.city || '')
  const [isPrivate, setIsPrivate] = useState(profile.is_private)
  const [pronouns, setPronouns] = useState(profile.pronouns || '')
  const [gender, setGender] = useState(profile.gender || '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar_url)

  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'same'>('idle')
  const [checkTimer, setCheckTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleUsernameChange(value: string) {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setUsername(cleaned)

    if (checkTimer) clearTimeout(checkTimer)

    if (!cleaned || cleaned === profile.username) {
      setHandleStatus(cleaned === profile.username ? 'same' : 'idle')
      return
    }
    if (cleaned.length < 3) {
      setHandleStatus('idle')
      return
    }

    setHandleStatus('checking')
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('check_handle_availability', { p_handle: cleaned })
      if (error) {
        setHandleStatus('idle')
        return
      }
      setHandleStatus(data ? 'available' : 'taken')
    }, 500)
    setCheckTimer(timer)
  }

  function handleAvatarChange(file: File | null) {
    setAvatarFile(file)
    if (file) setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!user) return
    if (handleStatus === 'taken') {
      setError('Yeh handle already liya ja chuka hai — koi doosra try karo.')
      return
    }

    setSaving(true)
    setError('')

    let avatarUrl: string | null = null
    if (avatarFile) {
      const filePath = `${user.id}/${Date.now()}-${avatarFile.name}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true })
      if (upErr) {
        setError('Photo upload nahi ho payi: ' + upErr.message)
        setSaving(false)
        return
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
      avatarUrl = urlData.publicUrl
    }

    if (username && username !== profile.username) {
      const { error: handleErr } = await supabase.rpc('set_creator_handle', {
        p_user_id: user.id,
        p_handle: username,
      })
      if (handleErr) {
        setError('Handle save nahi hua: ' + handleErr.message)
        setSaving(false)
        return
      }
    }

    const { error: detailsErr } = await supabase.rpc('update_profile_details', {
      p_full_name: fullName,
      p_bio: bio,
      p_city: city,
      p_is_private: isPrivate,
      p_avatar_url: avatarUrl,
      p_pronouns: pronouns,
      p_gender: gender,
    })

    setSaving(false)

    if (detailsErr) {
      setError('Save nahi hua: ' + detailsErr.message)
      return
    }

    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto bg-white rounded-t-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 flex-shrink-0">
          <span className="font-bold text-base">Edit Profile</span>
          <button onClick={onClose}><X size={20} className="text-stone-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-full bg-stone-200 overflow-hidden">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-stone-400">
                  {fullName?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </div>
            <label className="text-xs font-semibold text-clay cursor-pointer">
              Change Photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleAvatarChange(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-600">Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-600">Pronouns</label>
            <input
              value={pronouns}
              onChange={(e) => setPronouns(e.target.value)}
              placeholder="he/she/they (optional)"
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-600">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm mt-1"
            >
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-600">Handle</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">@</span>
              <input
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                className="w-full border border-stone-300 rounded-xl pl-7 pr-24 py-2 text-sm"
                placeholder="yourhandle"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold">
                {handleStatus === 'checking' && <span className="text-stone-400">Checking…</span>}
                {handleStatus === 'available' && <span className="text-mehendi">Available ✅</span>}
                {handleStatus === 'taken' && <span className="text-red-500">Taken ❌</span>}
                {handleStatus === 'same' && <span className="text-stone-400">Current</span>}
              </span>
            </div>
            <p className="text-[10px] text-stone-400 mt-1">sthamly.com/creator/{username || 'yourhandle'}</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-600">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={150}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm mt-1"
              placeholder="Apne baare mein kuch likho..."
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-600">City</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm mt-1"
              placeholder="Gonda"
            />
          </div>

          <div className="flex items-center justify-between border-t border-stone-100 pt-4">
            <div>
              <p className="text-sm font-semibold text-stone-800">Private Account</p>
              <p className="text-[11px] text-stone-500">
                {isPrivate
                  ? 'Naye followers ko pehle request bhejni hogi'
                  : 'Koi bhi turant follow kar sakta hai'}
              </p>
            </div>
            <button
              onClick={() => setIsPrivate((v) => !v)}
              className={`w-12 h-7 rounded-full flex-shrink-0 transition-colors relative ${
                isPrivate ? 'bg-clay' : 'bg-stone-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full transition-transform ${
                  isPrivate ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="px-4 py-3 border-t border-stone-100 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving || handleStatus === 'taken' || handleStatus === 'checking'}
            className="w-full bg-clay text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}