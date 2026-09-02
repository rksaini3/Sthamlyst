'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

type Comment = {
  id: string
  body: string | null
  audio_url: string | null
  created_at: string
  full_name: string | null
}

export default function CommentSheet({ lessonId, onClose }: { lessonId: string; onClose: () => void }) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [recording, setRecording] = useState(false)
  const [posting, setPosting] = useState(false)
  const [micError, setMicError] = useState('')
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const mediaStream = useRef<MediaStream | null>(null)
  const chunks = useRef<Blob[]>([])

  useEffect(() => {
    load()
  }, [lessonId])

  // Make sure the mic is released if the sheet gets closed (or the
  // component unmounts) while a recording is still in progress — otherwise
  // the browser's mic indicator stays on with nothing actually using it.
  useEffect(() => {
    return () => {
      mediaRecorder.current?.stop()
      mediaStream.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function load() {
    const { data } = await supabase
      .from('comments')
      .select('id, body, audio_url, created_at, profiles:user_id ( full_name )')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: false })

    if (data) {
      setComments(
        (data as any[]).map((c) => ({
          id: c.id,
          body: c.body,
          audio_url: c.audio_url,
          created_at: c.created_at,
          full_name: c.profiles?.full_name ?? null,
        }))
      )
    }
  }

  async function postText() {
    if (!user || !text.trim()) return
    setPosting(true)
    await supabase.rpc('add_comment', { p_lesson_id: lessonId, p_body: text.trim() })
    setText('')
    setPosting(false)
    load()
  }

  async function startRecording() {
    setMicError('')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setMicError('Mic access nahi mila — browser settings mein permission check karo.')
      return
    }

    mediaStream.current = stream
    chunks.current = []
    const mr = new MediaRecorder(stream)
    mr.ondataavailable = (e) => chunks.current.push(e.data)
    mr.onstop = handleRecordingStop
    mediaRecorder.current = mr
    mr.start()
    setRecording(true)
  }

  function stopRecording() {
    mediaRecorder.current?.stop()
    setRecording(false)
  }

  async function handleRecordingStop() {
    // Release the mic the moment recording stops, regardless of how the
    // upload below goes — the app has no further use for it either way.
    mediaStream.current?.getTracks().forEach((t) => t.stop())
    mediaStream.current = null

    if (!user) return
    setPosting(true)
    const blob = new Blob(chunks.current, { type: 'audio/webm' })
    const filePath = `${user.id}/${Date.now()}.webm`
    const { error: upErr } = await supabase.storage.from('comment-audio').upload(filePath, blob)
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('comment-audio').getPublicUrl(filePath)
      await supabase.rpc('add_comment', { p_lesson_id: lessonId, p_audio_url: urlData.publicUrl })
      load()
    } else {
      setMicError('Voice comment post nahi ho paya, dobara try karo.')
    }
    setPosting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full bg-white dark:bg-stone-900 rounded-t-2xl max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-stone-700">
          <span className="font-bold text-sm text-stone-900 dark:text-stone-100">Comments</span>
          <button onClick={onClose} className="text-stone-500 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="text-sm">
              <span className="font-semibold text-stone-800 dark:text-stone-100">{c.full_name ?? 'User'}</span>{' '}
              {c.body && <span className="text-stone-700 dark:text-stone-300">{c.body}</span>}
              {c.audio_url && (
                <audio src={c.audio_url} controls className="mt-1 h-8 w-full" />
              )}
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-xs text-stone-400 text-center py-6">Sabse pehle comment karo</p>
          )}
        </div>

        {micError && <p className="text-[11px] text-red-500 px-4 pb-1">{micError}</p>}

        <div className="flex items-center gap-2 px-4 py-3 border-t border-stone-100 dark:border-stone-700">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && postText()}
            placeholder="Comment likho..."
            className="flex-1 border border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 rounded-full px-3 py-2 text-sm"
          />
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={posting}
            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 ${
              recording ? 'bg-red-600 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
            }`}
          >
            🎙️
          </button>
          <button
            onClick={postText}
            disabled={posting || !text.trim()}
            className="text-amber-600 font-bold text-sm px-2 disabled:opacity-40 flex-shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
