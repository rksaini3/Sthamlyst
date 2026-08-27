'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Heart, MessageCircle } from 'lucide-react'
import PageSkeleton from './PageSkeleton'
import ShareButton from './ShareButton'
import OptionsMenu from './OptionsMenu'
import EmojiPicker from './EmojiPicker'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

type QuizQuestion = {
  question: string
  options: string[]
  correct_index: number
}

type Lesson = {
  id: string
  title: string
  description: string | null
  video_url: string | null
  craft_theme: string
  quiz_questions: QuizQuestion[]
  points_reward: number
  watch_reward: number
  is_user_generated: boolean
  creator_id: string | null
  tagged_product_id: string | null
  long_form_video_url: string | null
  long_form_title: string | null
}

type TaggedProduct = { id: string; title: string; price: number; image_url: string | null }
type CreatorInfo = {
  full_name: string | null
  username: string | null
  avatar_url: string | null
  is_verified: boolean
}

// Follow relationship with a creator, from the caller's point of view.
type FollowStatus = 'none' | 'requested' | 'accepted'

export default function ReelFeed({ themeFilter }: { themeFilter?: string | null }) {
  const { user } = useAuth()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [products, setProducts] = useState<Record<string, TaggedProduct>>({})
  const [creators, setCreators] = useState<Record<string, CreatorInfo>>({})
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set())
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [myFollowStatus, setMyFollowStatus] = useState<Record<string, FollowStatus>>({})
  const [followsMe, setFollowsMe] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  async function loadLessons() {
    setLoading(true)
    let query = supabase
      .from('lessons')
      .select('*')
      .eq('is_published', true)
      .order('order_index', { ascending: true })

    if (themeFilter) query = query.eq('craft_theme', themeFilter)

    const { data, error } = await query
    if (error || !data) { setLoading(false); return }

    setLessons(data as Lesson[])
    const lessonIds = (data as Lesson[]).map((l) => l.id)

    const productIds = (data as Lesson[]).map((l) => l.tagged_product_id).filter((id): id is string => !!id)
    const creatorIds = Array.from(
      new Set((data as Lesson[]).map((l) => l.creator_id).filter((id): id is string => !!id))
    )

    const [productRes, creatorRes, likesRes, commentsRes, myFollowsRes, followsMeRes] = await Promise.all([
      productIds.length > 0
        ? supabase.from('products').select('id, title, price, image_url').in('id', productIds)
        : Promise.resolve({ data: [] as any[] }),
      creatorIds.length > 0
        ? supabase.from('profiles').select('id, full_name, username, avatar_url, is_verified').in('id', creatorIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('likes').select('lesson_id, user_id').in('lesson_id', lessonIds),
      supabase.from('comments').select('lesson_id').in('lesson_id', lessonIds),
      // My outgoing follow status toward each creator on screen
      user && creatorIds.length > 0
        ? supabase.from('follows').select('following_id, status').eq('follower_id', user.id).in('following_id', creatorIds)
        : Promise.resolve({ data: [] as any[] }),
      // Which of these creators already follow ME back (for "Follow Back" label)
      user && creatorIds.length > 0
        ? supabase.from('follows').select('follower_id').eq('following_id', user.id).eq('status', 'accepted').in('follower_id', creatorIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const pMap: Record<string, TaggedProduct> = {}
    ;(productRes.data || []).forEach((p: any) => { pMap[p.id] = p })
    setProducts(pMap)

    const cMap: Record<string, CreatorInfo> = {}
    ;(creatorRes.data || []).forEach((c: any) => {
      cMap[c.id] = {
        full_name: c.full_name,
        username: c.username,
        avatar_url: c.avatar_url,
        is_verified: !!c.is_verified,
      }
    })
    setCreators(cMap)

    const likeCountMap: Record<string, number> = {}
    const myLikeSet = new Set<string>()
    ;(likesRes.data || []).forEach((l: any) => {
      likeCountMap[l.lesson_id] = (likeCountMap[l.lesson_id] || 0) + 1
      if (user && l.user_id === user.id) myLikeSet.add(l.lesson_id)
    })
    setLikeCounts(likeCountMap)
    setMyLikes(myLikeSet)

    const commentCountMap: Record<string, number> = {}
    ;(commentsRes.data || []).forEach((c: any) => {
      commentCountMap[c.lesson_id] = (commentCountMap[c.lesson_id] || 0) + 1
    })
    setCommentCounts(commentCountMap)

    const statusMap: Record<string, FollowStatus> = {}
    ;(myFollowsRes.data || []).forEach((f: any) => {
      statusMap[f.following_id] = f.status
    })
    setMyFollowStatus(statusMap)

    setFollowsMe(new Set((followsMeRes.data || []).map((f: any) => f.follower_id)))

    setLoading(false)
  }

  useEffect(() => {
    loadLessons()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeFilter, user])

  async function toggleLike(lessonId: string) {
    if (!user) return
    const nowLiked = !myLikes.has(lessonId)
    setMyLikes((prev) => {
      const next = new Set(prev)
      nowLiked ? next.add(lessonId) : next.delete(lessonId)
      return next
    })
    setLikeCounts((prev) => ({ ...prev, [lessonId]: (prev[lessonId] || 0) + (nowLiked ? 1 : -1) }))
    await supabase.rpc('toggle_like', { p_lesson_id: lessonId })
  }

  // Uses the v19 toggle_follow RPC, which itself decides whether the
  // result is an instant follow ('accepted') or a pending request
  // ('requested') based on the target's private-account setting.
  async function toggleFollow(creatorId: string) {
    if (!user) return
    const { data, error } = await supabase.rpc('toggle_follow', { p_target_user_id: creatorId })
    if (error) return
    setMyFollowStatus((prev) => ({ ...prev, [creatorId]: (data as FollowStatus) ?? 'none' }))
  }

  function bumpCommentCount(lessonId: string) {
    setCommentCounts((prev) => ({ ...prev, [lessonId]: (prev[lessonId] || 0) + 1 }))
  }

  if (loading) {
    return <PageSkeleton rows={2} />
  }

  return (
    <div className="px-4 pt-4 space-y-5">
      {lessons.map((lesson) => (
        <LessonCard
          key={lesson.id}
          lesson={lesson}
          taggedProduct={lesson.tagged_product_id ? products[lesson.tagged_product_id] : undefined}
          creator={lesson.creator_id ? creators[lesson.creator_id] : undefined}
          liked={myLikes.has(lesson.id)}
          likeCount={likeCounts[lesson.id] || 0}
          commentCount={commentCounts[lesson.id] || 0}
          followStatus={lesson.creator_id ? (myFollowStatus[lesson.creator_id] || 'none') : 'none'}
          creatorFollowsMe={lesson.creator_id ? followsMe.has(lesson.creator_id) : false}
          isMe={!!user && lesson.creator_id === user.id}
          onToggleLike={() => toggleLike(lesson.id)}
          onToggleFollow={() => lesson.creator_id && toggleFollow(lesson.creator_id)}
          onCommentAdded={() => bumpCommentCount(lesson.id)}
          onDeleted={loadLessons}
        />
      ))}
      {lessons.length === 0 && (
        <p className="text-center text-stone-400 pt-10">No reels in this category yet.</p>
      )}
    </div>
  )
}

function LessonCard({
  lesson, taggedProduct, creator, liked, likeCount, commentCount,
  followStatus, creatorFollowsMe, isMe,
  onToggleLike, onToggleFollow, onCommentAdded, onDeleted,
}: {
  lesson: Lesson
  taggedProduct?: TaggedProduct
  creator?: CreatorInfo
  liked: boolean
  likeCount: number
  commentCount: number
  followStatus: FollowStatus
  creatorFollowsMe: boolean
  isMe: boolean
  onToggleLike: () => void
  onToggleFollow: () => void
  onCommentAdded: () => void
  onDeleted: () => void
}) {
  const router = useRouter()

  // Variable quiz frequency: only ~1 in 3 lessons shows a quiz overlay
  // when the video ends — a stable pseudo-random pick per lesson (not
  // re-rolled on every render), so it feels occasional, not predictable,
  // without ever being mandatory to keep scrolling.
  const showsQuiz = hashToBucket(lesson.id) % 3 === 0

  async function handleDelete() {
    if (!confirm('Ye reel delete kar dein?')) return
    await supabase.rpc('delete_lesson', { p_lesson_id: lesson.id })
    onDeleted()
  }

  function handleRemix() {
    router.push(`/upload?remixOf=${lesson.id}`)
  }

  const [videoEnded, setVideoEnded] = useState(false)
  const [quizStep, setQuizStep] = useState(0) // 0 = first question, 1 = second
  const [answers, setAnswers] = useState<number[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [rewardGiven, setRewardGiven] = useState(false)
  const [showComments, setShowComments] = useState(false)

  async function handleVideoEnded() {
    if (rewardGiven) return
    setVideoEnded(true)

    if (!showsQuiz) {
      // No quiz this time — just a small, silent watch reward.
      const { data, error } = await supabase.rpc('award_watch_reward', { p_lesson_id: lesson.id })
      setRewardGiven(true)
      if (!error && typeof data === 'number' && data > 0) {
        setToast(`+${data} Coins for watching`)
        setTimeout(() => setToast(null), 2000)
      }
    }
  }

  async function answerQuiz(optionIndex: number) {
    const isLast = quizStep === lesson.quiz_questions.length - 1
    const nextAnswers = [...answers, optionIndex]
    setAnswers(nextAnswers)

    if (!isLast) {
      setQuizStep(quizStep + 1)
      return
    }

    // All questions answered — score it.
    const allCorrect = lesson.quiz_questions.every((q, i) => nextAnswers[i] === q.correct_index)
    setRewardGiven(true)
    setVideoEnded(false) // hide the overlay, whatever the result

    if (allCorrect) {
      const { data, error } = await supabase.rpc('complete_lesson', { p_lesson_id: lesson.id })
      if (!error && typeof data === 'number') {
        setToast(`✓ +${data} Coins earned!`)
      }
    } else {
      setToast('Not quite — koi baat nahi, aage badho')
    }
    setTimeout(() => setToast(null), 2200)
  }

  function skipQuiz() {
    setVideoEnded(false)
    setRewardGiven(true)
  }

  const currentQuestion = lesson.quiz_questions[quizStep]

  const followLabel =
    followStatus === 'accepted' ? 'Following' :
    followStatus === 'requested' ? 'Requested ⏳' :
    creatorFollowsMe ? 'Follow Back' : 'Follow'

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
      <div className="relative aspect-[9/16] bg-stone-200">
        {lesson.video_url ? (
          <video
            src={lesson.video_url}
            controls
            onEnded={handleVideoEnded}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm">
            1-min maker video
          </div>
        )}

        {/* 1-tap poll-style quiz overlay — appears only on video end, only
            for the ~1-in-3 lessons chosen for this session, and can be
            skipped without any penalty beyond not earning the bonus. */}
        {videoEnded && showsQuiz && currentQuestion && !rewardGiven && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center px-6">
            <p className="text-white text-sm font-semibold text-center mb-3">
              {currentQuestion.question}
            </p>
            <div className="w-full space-y-2">
              {currentQuestion.options.map((opt, oi) => (
                <button
                  key={oi}
                  onClick={() => answerQuiz(oi)}
                  className="w-full bg-white/95 hover:bg-white text-stone-900 font-semibold text-sm py-2.5 rounded-full"
                >
                  {opt}
                </button>
              ))}
            </div>
            <button onClick={skipQuiz} className="text-white/70 text-xs mt-4 underline">
              Skip
            </button>
          </div>
        )}

        {/* Reward toast */}
        {toast && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-mehendi text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg">
            {toast}
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-semibold text-turmeric bg-turmeric-light px-2 py-0.5 rounded-full">
              {lesson.craft_theme}
            </span>
            {lesson.is_user_generated && creator && (
              <span className="text-[11px] font-semibold text-stone-600 truncate flex items-center gap-1">
                by {creator.username ? `@${creator.username}` : (creator.full_name || 'Creator')}
                {creator.is_verified && <span className="text-sky-500">✔️</span>}
              </span>
            )}
          </div>
          {lesson.is_user_generated && lesson.creator_id && !isMe && (
            <button
              onClick={onToggleFollow}
              className={`text-[11px] font-bold px-3 py-1 rounded-full flex-shrink-0 whitespace-nowrap ${
                followStatus === 'accepted'
                  ? 'bg-stone-100 text-stone-600'
                  : followStatus === 'requested'
                  ? 'bg-stone-100 text-stone-500'
                  : 'bg-indigobrand text-white'
              }`}
            >
              {followLabel}
            </button>
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={handleRemix} className="text-stone-400" title="Remix">
              🎵
            </button>
            <ShareButton url="/" title={lesson.title} text={`${lesson.title} — Sthamly par dekho`} />
            <OptionsMenu isOwner={isMe} onDelete={handleDelete} />
          </div>
        </div>

        <h2 className="font-bold text-stone-900 mt-2">{lesson.title}</h2>
        <p className="text-sm text-stone-500 mt-1">{lesson.description}</p>

        {lesson.long_form_video_url && (
          <Link
            href={`/lesson/${lesson.id}`}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-clay"
          >
            📺 {lesson.long_form_title || 'See Full Lesson'} →
          </Link>
        )}

        {taggedProduct && (
          <Link
            href="/bazaar"
            className="mt-3 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-2.5"
          >
            {taggedProduct.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={taggedProduct.image_url} alt={taggedProduct.title} className="w-12 h-12 rounded-lg object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-stone-800 truncate">{taggedProduct.title}</p>
              <p className="text-xs text-clay font-bold">₹{taggedProduct.price}</p>
            </div>
            <span className="text-[11px] font-bold bg-clay text-white px-3 py-1.5 rounded-full whitespace-nowrap">
              Buy Now
            </span>
          </Link>
        )}

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-stone-100">
          <button onClick={onToggleLike} className="flex items-center gap-1.5">
            <Heart size={20} className={liked ? 'fill-clay text-clay' : 'text-stone-400'} />
            <span className="text-xs text-stone-600">{likeCount}</span>
          </button>
          <button onClick={() => setShowComments((v) => !v)} className="flex items-center gap-1.5">
            <MessageCircle size={20} className="text-stone-400" />
            <span className="text-xs text-stone-600">{commentCount}</span>
          </button>
          <span className="text-[10px] text-stone-400 ml-auto">
            {showsQuiz ? `Quiz on this one · +${lesson.points_reward} Coins` : `+${lesson.watch_reward} Coins for watching`}
          </span>
        </div>

        {showComments && <CommentsPanel lessonId={lesson.id} onCommentAdded={onCommentAdded} />}
      </div>
    </div>
  )
}

// Small stable hash so the same lesson always lands in the same
// quiz/no-quiz bucket for a given session — not re-randomized on
// every re-render, but still varies lesson to lesson.
function hashToBucket(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return hash
}

type Comment = {
  id: string
  user_id: string
  body: string | null
  audio_url: string | null
  created_at: string
  profiles: { full_name: string | null } | null
}

function CommentsPanel({ lessonId, onCommentAdded }: { lessonId: string; onCommentAdded: () => void }) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  async function load() {
    const { data } = await supabase
      .from('comments')
      .select('id, user_id, body, audio_url, created_at, profiles:user_id ( full_name )')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: true })
    if (data) setComments(data as unknown as Comment[])
    setLoading(false)
  }

  async function post() {
    if (!text.trim() || !user) return
    setPosting(true)
    const { error } = await supabase.rpc('add_comment', { p_lesson_id: lessonId, p_body: text.trim() })
    if (!error) {
      setComments((prev) => [
        ...prev,
        { id: Math.random().toString(), user_id: user.id, body: text.trim(), audio_url: null, created_at: new Date().toISOString(), profiles: { full_name: 'You' } },
      ])
      onCommentAdded()
      setText('')
    }
    setPosting(false)
  }

  async function startRecording() {
    if (!user) return
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    chunksRef.current = []
    const mr = new MediaRecorder(stream)
    mr.ondataavailable = (e) => chunksRef.current.push(e.data)
    mr.onstop = handleRecordingStop
    mediaRecorderRef.current = mr
    mr.start()
    setRecording(true)
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function handleRecordingStop() {
    if (!user) return
    setPosting(true)
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const filePath = `${user.id}/${Date.now()}.webm`
    const { error: upErr } = await supabase.storage.from('comment-audio').upload(filePath, blob)
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('comment-audio').getPublicUrl(filePath)
      const { error } = await supabase.rpc('add_comment', { p_lesson_id: lessonId, p_audio_url: urlData.publicUrl })
      if (!error) {
        setComments((prev) => [
          ...prev,
          { id: Math.random().toString(), user_id: user.id, body: null, audio_url: urlData.publicUrl, created_at: new Date().toISOString(), profiles: { full_name: 'You' } },
        ])
        onCommentAdded()
      }
    }
    setPosting(false)
  }

  async function deleteComment(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id))
    await supabase.rpc('delete_comment', { p_comment_id: id })
  }

  return (
    <div className="mt-3 bg-stone-50 rounded-xl p-3 space-y-2">
      {loading ? (
        <p className="text-xs text-stone-400">Loading comments…</p>
      ) : (
        comments.map((c) => (
          <div key={c.id} className="flex items-start justify-between gap-2 text-xs">
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-stone-800">{c.profiles?.full_name || 'User'}: </span>
              {c.body && <span className="text-stone-600">{c.body}</span>}
              {c.audio_url && <audio src={c.audio_url} controls className="mt-1 h-7 w-full max-w-[200px]" />}
            </div>
            {user && c.user_id === user.id && (
              <button onClick={() => deleteComment(c.id)} className="text-stone-400 flex-shrink-0">×</button>
            )}
          </div>
        ))
      )}
      {comments.length === 0 && !loading && <p className="text-xs text-stone-400">No comments yet — be the first!</p>}

      {user ? (
        <div className="flex items-center gap-2 pt-1">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && post()}
            placeholder="Add a comment…"
            className="flex-1 border border-stone-300 rounded-full px-3 py-1.5 text-xs"
          />
          <EmojiPicker onSelect={(e) => setText((t) => t + e)} />
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${
              recording ? 'bg-red-600 text-white' : 'bg-stone-200 text-stone-600'
            }`}
          >
            🎙️
          </button>
          <button onClick={post} disabled={posting || !text.trim()} className="text-xs font-semibold text-clay flex-shrink-0">
            Post
          </button>
        </div>
      ) : (
        <Link href="/login" className="text-xs text-clay font-semibold">Sign in to comment</Link>
      )}
    </div>
  )
}
