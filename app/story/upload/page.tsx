'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

export default function StoryUploadPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    setError('')
    if (!file) {
      setError('Photo ya video chuno.')
      return
    }
    if (!user) {
      router.push('/login')
      return
    }

    const MAX_MB = 30
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File ${MAX_MB}MB se choti honi chahiye. Abhi ${(file.size / (1024 * 1024)).toFixed(1)}MB hai.`)
      return
    }

    setUploading(true)
    const mediaType = file.type.startsWith('video') ? 'video' : 'image'
    const filePath = `${user.id}/${Date.now()}-${file.name}`

    let uploadError: any = null
    try {
      const result = await supabase.storage.from('stories').upload(filePath, file)
      uploadError = result.error
    } catch (e: any) {
      uploadError = e
    }

    if (uploadError) {
      setError('Upload fail: ' + (uploadError.message || 'network error, try again'))
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('stories').getPublicUrl(filePath)

    const { error: rpcError } = await supabase.rpc('create_story', {
      p_media_url: urlData.publicUrl,
      p_media_type: mediaType,
      p_caption: caption || null,
    })

    setUploading(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    router.push('/')
  }

  return (
    <div className="max-w-md mx-auto min-h-dvh px-4 pt-6 pb-24">
      <h1 className="text-xl font-bold text-amber-900">Add to Your Story</h1>
      <p className="text-xs text-stone-500 mt-1">Visible to everyone for 24 hours, then it disappears.</p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="text-sm font-semibold text-stone-800">Photo or video</label>
          <input
            type="file"
            accept="image/*,video/*"
            capture="environment"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm mt-1"
          />
          {file && (
            <p className="text-[11px] text-stone-500 mt-1">
              {file.name} · {(file.size / (1024 * 1024)).toFixed(1)}MB
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-semibold text-stone-800">Caption (optional)</label>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="What's happening?"
            className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm mt-1"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="w-full bg-amber-600 text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50"
        >
          {uploading ? 'Posting…' : 'Post to Story'}
        </button>
      </div>
    </div>
  )
}
