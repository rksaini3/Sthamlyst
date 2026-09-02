'use client'

import { useEffect, useRef, useState } from 'react'
import { ThumbsUp, ThumbsDown, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

type Comment = {
  id: string
  parent_comment_id: string | null
  body: string | null
  audio_url: string | null
  created_at: string
  full_name: string | null
  like_count: number
  dislike_count: number
  reply_count: number
  my_reaction: 'like' | 'dislike' | null
}

const AVATAR_COLORS = ['bg-clay', 'bg-mehendi', 'bg-indigobrand', 'bg-violet', 'bg-turmeric']

function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'abhi'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo`
  return `${Math.floor(months / 12)}y`
}

export default function CommentSheet({ lessonId, onClose }: { lessonId: string; onClose: () => void }) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [recording, setRecording] = useState(false)
  const [posting, setPosting] = useState(false)
  const [micError, setMicError] = useState('')
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [reactingId, setReactingId] = useState<string | null>(null)

  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const mediaStream = useRef<MediaStream | null>(null)
  const chunks = useRef<Blob[]>([])

  useEffect(() => {
    load()
  }, [lessonId])

  useEffect(() => {
    return () => {
      mediaRecorder.current?.stop()
      mediaStream.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function load() {
    const { data, error } = await supabase.rpc('get_comments_for_lesson', { p_lesson_id: lessonId })
    if (error) {
      console.error('load comments failed:', error)
      return
    }
    setComments((data as Comment[]) || [])
  }

  const topLevel = comments.filter((c) => !c.parent_comment_id)
  const repliesFor = (parentId: string) => comments.filter((c) => c.parent_comment_id === parentId)

  function toggleReplies(id: string) {
    setExpandedReplies((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function react(commentId: string, reaction: 'like' | 'dislike') {
    if (!user || reactingId) return
    setReactingId(commentId)
    const { error } = await supabase.rpc('react_to_comment', { p_comment_id: commentId, p_reaction: reaction })
    setReactingId(null)
    if (error) {
      setMicError('Reaction save nahi hui, dobara try karo.')
      return
    }
    load()
  }

  async function postText() {
    if (!user || !text.trim()) return
    setPosting(true)
    const { error } = await supabase.rpc('add_comment', { p_lesson_id: lessonId, p_body: text.trim() })
    setPosting(false)
    if (error) {
      setMicError('Comment post nahi ho paya, dobara try karo.')
      return
    }
    setText('')
    load()
  }

  async function postReply(parentId: string) {
    if (!user || !replyText.trim()) return
    setPosting(true)
    const { error } = await supabase.rpc('add_comment', {
      p_lesson_id: lessonId,
      p_body: replyText.trim(),
      p_parent_comment_id: parentId,
    })
    setPosting(false)
    if (error) {
      setMicError('Reply post nahi ho paya, dobara try karo.')
      return
    }
    setReplyText('')
    setReplyingTo(null)
    setExpandedReplies((prev) => new Set(prev).add(parentId))
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
    mediaStream.current?.getTracks().forEach((t) => t.stop())
    mediaStream.current = null
    if (!user) return
    setPosting(true)
    const blob = new Blob(chunks.current, { type: 'audio/webm' })
    const filePath = `${user.id}/${Date.now()}.webm`
    const { error: upErr } = await supabase.storage.from('comment-audio').upload(filePath, blob)
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('comment-audio').getPublicUrl(filePath)
      const { error } = await supabase.rpc('add_comment', { p_lesson_id: lessonId, p_audio_url: urlData.publicUrl })
      if (error) setMicError('Voice comment post nahi ho paya, dobara try karo.')
      else load()
    } else {
      setMicError('Voice comment upload nahi ho paya, dobara try karo.')
    }
    setPosting(false)
  }

  function ReactionRow({ c }: { c: Comment }) {
    return (
      <div className="flex items-center gap-3 mt-1">
        <button
          onClick={() => react(c.id, 'like')}
          disabled={reactingId === c.id}
          className={`flex items-center gap-1 text-[11px] ${c.my_reaction === 'like' ? 'text-clay font-semibold' : 'text-stone-400'}`}
        >
          <ThumbsUp size={13} fill={c.my_reaction === 'like' ? 'currentColor' : 'none'} /> {c.like_count > 0 && c.like_count}
        </button>
        <button
          onClick={() => react(c.id, 'dislike')}
          disabled={reactingId === c.id}
          className={`flex items-center gap-1 text-[11px] ${c.my_reaction === 'dislike' ? 'text-stone-700 dark:text-stone-200 font-semibold' : 'text-stone-400'}`}
        >
          <ThumbsDown size={13} fill={c.my_reaction === 'dislike' ? 'currentColor' : 'none'} /> {c.dislike_count > 0 && c.dislike_count}
        </button>
        {!c.parent_comment_id && (
          <button
            onClick={() => { setReplyingTo(replyingTo === c.id ? null : c.id); setReplyText('') }}
            className="text-[11px] text-stone-400 font-semibold"
          >
            Reply
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full bg-white dark:bg-stone-900 rounded-t-2xl max-h-[75vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-stone-700">
          <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
            Comments {topLevel.length > 0 && <span className="text-stone-400 font-normal">· {topLevel.length}</span>}
          </span>
          <button onClick={onClose} className="text-stone-500 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {topLevel.map((c) => {
            const name = c.full_name ?? 'Sthamly User'
            const replies = repliesFor(c.id)
            const expanded = expandedReplies.has(c.id)
            return (
              <div key={c.id}>
                <div className="flex gap-3">
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white ${avatarColor(name)}`}>
                    {name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs">
                      <span className="font-semibold text-stone-800 dark:text-stone-100">{name}</span>{' '}
                      <span className="text-stone-400">· {timeAgo(c.created_at)}</span>
                    </p>
                    {c.body && <p className="text-sm text-stone-700 dark:text-stone-300 mt-0.5">{c.body}</p>}
                    {c.audio_url && <audio src={c.audio_url} controls className="mt-1.5 h-8 w-full max-w-[240px]" />}
                    <ReactionRow c={c} />

                    {replyingTo === c.id && (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && postReply(c.id)}
                          placeholder={`${name} ko reply karo...`}
                          autoFocus
                          className="flex-1 border border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 rounded-full px-3 py-1.5 text-xs"
                        />
                        <button
                          onClick={() => postReply(c.id)}
                          disabled={posting || !replyText.trim()}
                          className="text-amber-600 font-bold text-xs px-1 disabled:opacity-40 flex-shrink-0"
                        >
                          Send
                        </button>
                      </div>
                    )}

                    {replies.length > 0 && (
                      <button
                        onClick={() => toggleReplies(c.id)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-clay mt-2"
                      >
                        <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                      </button>
                    )}

                    {expanded && (
                      <div className="mt-3 space-y-3 border-l-2 border-stone-100 dark:border-stone-700 pl-3">
                        {replies.map((r) => {
                          const rName = r.full_name ?? 'Sthamly User'
                          return (
                            <div key={r.id} className="flex gap-2.5">
                              <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white ${avatarColor(rName)}`}>
                                {rName[0]?.toUpperCase() ?? '?'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px]">
                                  <span className="font-semibold text-stone-800 dark:text-stone-100">{rName}</span>{' '}
                                  <span className="text-stone-400">· {timeAgo(r.created_at)}</span>
                                </p>
                                {r.body && <p className="text-xs text-stone-700 dark:text-stone-300 mt-0.5">{r.body}</p>}
                                {r.audio_url && <audio src={r.audio_url} controls className="mt-1 h-7 w-full max-w-[200px]" />}
                                <ReactionRow c={r} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {topLevel.length === 0 && (
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
