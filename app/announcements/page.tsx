'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'
import ShareButton from '@/components/ShareButton'
import OptionsMenu from '@/components/OptionsMenu'
import EmojiPicker from '@/components/EmojiPicker'
import VerifiedBadge from '@/components/VerifiedBadge'

type Announcement = {
  id: string
  user_id: string
  body: string
  image_url: string | null
  created_at: string
  profiles: { full_name: string | null; seller_verified: boolean } | null
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB

export default function AnnouncementsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, user_id, body, image_url, created_at, profiles:user_id ( full_name, seller_verified )')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      console.error('announcements fetch failed:', error)
      setLoading(false)
      return
    }
    if (data) setItems(data as unknown as Announcement[])
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Ye announcement delete kar dein?')) return
    const removed = items.find((a) => a.id === id)
    setItems((prev) => prev.filter((a) => a.id !== id))

    const { error } = await supabase.rpc('delete_announcement', { p_announcement_id: id })
    if (error) {
      // Roll back — the delete didn't actually go through, so don't
      // leave it looking gone from the UI.
      console.error('delete_announcement failed:', error)
      if (removed) setItems((prev) => [...prev, removed].sort((a, b) => b.created_at.localeCompare(a.created_at)))
      alert('Delete nahi ho paaya, dobara try karo.')
    }
  }

  function handleImageChange(file: File | null) {
    setPostError('')
    if (!file) {
      setImageFile(null)
      return
    }
    if (!file.type.startsWith('image/')) {
      setPostError('Sirf image file select karo.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setPostError('Photo 5MB se chhoti honi chahiye.')
      return
    }
    setImageFile(file)
  }

  async function handlePost() {
    if (!text.trim() || !user) return
    setPosting(true)
    setPostError('')

    let imageUrl: string | null = null
    if (imageFile) {
      const filePath = `${user.id}/${Date.now()}-${imageFile.name}`
      const { error: uploadError } = await supabase.storage.from('announcements').upload(filePath, imageFile)
      if (uploadError) {
        setPosting(false)
        setPostError('Photo upload nahi ho paayi: ' + uploadError.message + ' — dobara try karo.')
        return
      }
      const { data } = supabase.storage.from('announcements').getPublicUrl(filePath)
      imageUrl = data.publicUrl
    }

    const { error } = await supabase.rpc('post_announcement', { p_body: text.trim(), p_image_url: imageUrl })
    setPosting(false)
    if (error) {
      setPostError(error.message)
      return
    }

    setText('')
    setImageFile(null)
    // Native file inputs don't clear their displayed filename just
    // because the React state resets — reset the input element itself
    // too, otherwise it looks like the old image is still attached.
    if (fileInputRef.current) fileInputRef.current.value = ''
    load()
  }

  return (
    <div className="max-w-md mx-auto pb-24 min-h-dvh">
      <header className="sticky top-0 bg-white/95 dark:bg-stone-900/95 backdrop-blur px-4 py-3 border-b border-stone-100 dark:border-stone-800 z-10">
        <h1 className="text-lg font-heading font-semibold text-clay">Announcements</h1>
        <p className="text-xs text-stone-500 dark:text-stone-400">Daily updates from makers — no video needed</p>
      </header>

      {user && (
        <div className="px-4 pt-4 pb-2 border-b border-stone-100 dark:border-stone-800">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="आज क्या नया है? (जैसे: आज 50 नए मटके तैयार हैं)"
            maxLength={280}
            rows={2}
            className="w-full border border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 rounded-xl px-3 py-2 text-sm resize-none"
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-stone-400">{text.length}/280</span>
          </div>
          {postError && <p className="text-xs text-red-600 mt-1">{postError}</p>}
          <div className="flex items-center justify-between mt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
              className="text-xs dark:text-stone-300"
            />
            <div className="flex items-center gap-2">
              <EmojiPicker onSelect={(e) => setText((t) => t + e)} />
              <button
                onClick={handlePost}
                disabled={posting || !text.trim()}
                className="bg-clay text-white text-xs font-semibold px-4 py-2 rounded-full disabled:opacity-50"
              >
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pt-3 space-y-3">
        {loading && <p className="text-center text-stone-400 text-sm">Loading…</p>}
        {items.map((a) => (
          <div key={a.id} className="border-b border-stone-100 dark:border-stone-800 pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-300">
                  {a.profiles?.full_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-800 dark:text-stone-100 flex items-center">
                    {a.profiles?.full_name || 'Sthamly User'}
                    {a.profiles?.seller_verified && (
                      <span className="ml-1"><VerifiedBadge size={13} /></span>
                    )}
                  </p>
                  <p className="text-[10px] text-stone-400">
                    {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <ShareButton url="/announcements" title="Sthamly Announcement" text={a.body} />
                <OptionsMenu isOwner={!!user && a.user_id === user.id} onDelete={() => handleDelete(a.id)} />
              </div>
            </div>
            <p className="text-sm text-stone-700 dark:text-stone-300 mt-2">{a.body}</p>
            {a.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.image_url} alt="" className="mt-2 rounded-xl w-full object-cover max-h-64" />
            )}
          </div>
        ))}
        {!loading && items.length === 0 && (
          <p className="text-center text-stone-400 text-sm pt-10">No announcements yet.</p>
        )}
      </div>
    </div>
  )
}
