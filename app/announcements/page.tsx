'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

type Announcement = {
  id: string
  body: string
  image_url: string | null
  created_at: string
  profiles: { full_name: string | null; seller_verified: boolean } | null
}

export default function AnnouncementsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('announcements')
      .select('id, body, image_url, created_at, profiles:user_id ( full_name, seller_verified )')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setItems(data as unknown as Announcement[])
    setLoading(false)
  }

  async function handlePost() {
    if (!text.trim() || !user) return
    setPosting(true)

    let imageUrl: string | null = null
    if (imageFile) {
      const filePath = `${user.id}/${Date.now()}-${imageFile.name}`
      const { error: uploadError } = await supabase.storage.from('announcements').upload(filePath, imageFile)
      if (!uploadError) {
        const { data } = supabase.storage.from('announcements').getPublicUrl(filePath)
        imageUrl = data.publicUrl
      }
    }

    const { error } = await supabase.rpc('post_announcement', { p_body: text.trim(), p_image_url: imageUrl })
    setPosting(false)
    if (!error) {
      setText('')
      setImageFile(null)
      load()
    }
  }

  return (
    <div className="max-w-md mx-auto pb-24 min-h-dvh">
      <header className="sticky top-0 bg-white/95 backdrop-blur px-4 py-3 border-b border-stone-100 z-10">
        <h1 className="text-lg font-heading font-semibold text-clay">Announcements</h1>
        <p className="text-xs text-stone-500">Daily updates from makers — no video needed</p>
      </header>

      {user && (
        <div className="px-4 pt-4 pb-2 border-b border-stone-100">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="आज क्या नया है? (जैसे: आज 50 नए मटके तैयार हैं)"
            maxLength={280}
            rows={2}
            className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              className="text-xs"
            />
            <button
              onClick={handlePost}
              disabled={posting || !text.trim()}
              className="bg-clay text-white text-xs font-semibold px-4 py-2 rounded-full disabled:opacity-50"
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      )}

      <div className="px-4 pt-3 space-y-3">
        {loading && <p className="text-center text-stone-400 text-sm">Loading…</p>}
        {items.map((a) => (
          <div key={a.id} className="border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigobrand-light flex items-center justify-center text-xs font-bold text-indigobrand">
                {a.profiles?.full_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-800">
                  {a.profiles?.full_name || 'Sthamly User'}
                  {a.profiles?.seller_verified && <span className="text-mehendi ml-1">✓</span>}
                </p>
                <p className="text-[10px] text-stone-400">
                  {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <p className="text-sm text-stone-700 mt-2">{a.body}</p>
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
