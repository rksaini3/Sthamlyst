'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart, MessageCircle } from 'lucide-react'
import PageSkeleton from './PageSkeleton'
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
type CreatorInfo = { full_name: string | null }

export default function ReelFeed({ themeFilter }: { themeFilter?: string | null }) {
  const { user } = useAuth()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [products, setProducts] = useState<Record<string, TaggedProduct>>({})
  const [creators, setCreators] = useState<Record<string, CreatorInfo>>({})
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set())
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [myFollows, setMyFollows] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
      const creatorIds = (data as Lesson[]).map((l) => l.creator_id).filter((id): id is string => !!id)

      const [productRes, creatorRes, likesRes, commentsRes, followsRes] = await Promise.all([
        productIds.length > 0
          ? supabase.from('products').select('id, title, price, image_url').in('id', productIds)
          : Promise.resolve({ data: [] as any[] }),
        creatorIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', creatorIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from('likes').select('lesson_id, user_id').in('lesson_id', lessonIds),
        supabase.from('comments').select('lesson_id').in('lesson_id', lessonIds),
        user && creatorIds.length > 0
          ? supabase.from('follows').select('following_id').eq('follower_id', user.id).in('following_id', creatorIds)
          : Promise.resolve({ data: [] as any[] }),
      ])

      const pMap: Record<string, TaggedProduct> = {}
      ;(productRes.data || []).forEach((p: any) => { pMap[p.id] = p })
      setProducts(pMap)

      const cMap: Record<string, CreatorInfo> = {}
      ;(creatorRes.data || []).forEach((c: any) => { cMap[c.id] = c })
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

      setMyFollows(new Set((followsRes.data || []).map((f: any) => f.following_id)))

      setLoading(false)
    }
    loadLessons()
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

  async function toggleFollow(creatorId: string) {
    if (!user) return
    const nowFollowing = !myFollows.has(creatorId)
    setMyFollows((prev) => {
      const next = new Set(prev)
      nowFollowing ? next.add(creatorId) : next.delete(creatorId)
      return next
    })
    await supabase.rpc('toggle_follow', { p_target_user_id: creatorId })
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
          following={lesson.creator_id ? myFollows.has(lesson.creator_id) : false}
          isMe={!!user && lesson.creator_id === user.id}
          onToggleLike={() => toggleLike(lesson.id)}
          onToggleFollow={() => lesson.creator_id && toggleFollow(lesson.creator_id)}
          onCommentAdded={() => bumpCommentCount(lesson.id)}
        />
      ))}
      {lessons.length === 0 && (
        <p className="text-center text-stone-400 pt-10">No reels in this category yet.</p>
      )}
    </div>
  )
}

function LessonCard({
  lesson, taggedProduct, creator, liked, likeCount, commentCount, following, isMe,
  onToggleLike, onToggleFollow, onCommentAdded,
}: {
  lesson: Lesson
  taggedProduct?: TaggedProduct
  creator?: CreatorInfo
  liked: boolean
  likeCount: number
  commentCount: number
  following: boolean
  isMe: boolean
  onToggleLike: () => void
  onToggleFollow: () => void
  onCommentAdded: () => void
}) {
  // Variable quiz frequency: only ~1 in 3 lessons shows a quiz overlay
  // when the video ends — a stable pseudo-random pick per lesson (not
  // re-rolled on every render), so it feels occasional, not predictable,
  // without ever being mandatory to keep scrolling.
  const showsQuiz = hashToBucket(lesson.id) % 3 === 0

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
              <span className="text-[11px] font-semibold text-stone-600 truncate">
                by {creator.full_name || 'Creator'}
              </span>
            )}
          </div>
          {lesson.is_user_generated && lesson.creator_id && !isMe && (
            <button
              onClick={onToggleFollow}
              className={`text-[11px] font-bold px-3 py-1 rounded-full flex-shrink-0 ${
                following ? 'bg-stone-100 text-stone-600' : 'bg-indigobrand text-white'
              }`}
            >
              {following ? 'Following' : 'Follow'}
            </button>
          )}
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

type Comment = { id: string; body: string; created_at: string; profiles: { full_name: string | null } | null }

function CommentsPanel({ lessonId, onCommentAdded }: { lessonId: string; onCommentAdded: () => void }) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('comments')
        .select('id, body, created_at, profiles:user_id ( full_name )')
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: true })
      if (data) setComments(data as unknown as Comment[])
      setLoading(false)
    }
    load()
  }, [lessonId])

  async function post() {
    if (!text.trim() || !user) return
    setPosting(true)
    const { error } = await supabase.rpc('add_comment', { p_lesson_id: lessonId, p_body: text.trim() })
    if (!error) {
      setComments((prev) => [...prev, { id: Math.random().toString(), body: text.trim(), created_at: new Date().toISOString(), profiles: { full_name: 'You' } }])
      onCommentAdded()
      setText('')
    }
    setPosting(false)
  }

  return (
    <div className="mt-3 bg-stone-50 rounded-xl p-3 space-y-2">
      {loading ? (
        <p className="text-xs text-stone-400">Loading comments…</p>
      ) : (
        comments.map((c) => (
          <div key={c.id} className="text-xs">
            <span className="font-semibold text-stone-800">{c.profiles?.full_name || 'User'}: </span>
            <span className="text-stone-600">{c.body}</span>
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
          <button onClick={post} disabled={posting} className="text-xs font-semibold text-clay">
            Post
          </button>
        </div>
      ) : (
        <Link href="/login" className="text-xs text-clay font-semibold">Sign in to comment</Link>
      )}
    </div>
  )
}
