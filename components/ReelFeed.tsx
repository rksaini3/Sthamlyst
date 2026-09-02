'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Heart, MessageCircle, Share2, MoreHorizontal, BadgeCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'
import CommentSheet from '@/components/CommentSheet'

type QuizQuestion = { question: string; options: string[]; correct_index: number }

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
type CreatorInfo = { full_name: string | null; username: string | null; avatar_url: string | null; is_verified: boolean }
type FollowStatus = 'none' | 'requested' | 'accepted'

function WhatsAppIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="12" fill="#25D366" />
      <path
        d="M12 5.3A6.7 6.7 0 0 0 6.6 16l-.7 2.5 2.6-.7A6.7 6.7 0 1 0 12 5.3Zm3.9 9.5c-.2.5-1 .9-1.4.9-.4.1-.8.1-1.3-.1a8 8 0 0 1-2.5-1.6 9 9 0 0 1-1.7-2.2c-.2-.4-.5-1-.5-1.5 0-.5.3-.8.4-1l.3-.3c.1-.1.2-.2.3-.1l.9 1.7c.1.1.1.3 0 .4l-.3.4c-.1.1-.2.3-.1.4a5 5 0 0 0 1 1.3 5 5 0 0 0 1.4 1c.1.1.3.1.4-.1l.4-.5c.1-.1.3-.2.4-.1l1.6.8c.1.1.2.1.2.3 0 .1 0 .3-.1.4Z"
        fill="white"
      />
    </svg>
  )
}

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
  const [openCommentsFor, setOpenCommentsFor] = useState<string | null>(null)

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
    const creatorIds = Array.from(new Set((data as Lesson[]).map((l) => l.creator_id).filter((id): id is string => !!id)))

    const [productRes, creatorRes, likesRes, commentsRes, myFollowsRes, followsMeRes] = await Promise.all([
      productIds.length > 0
        ? supabase.from('products').select('id, title, price, image_url').in('id', productIds)
        : Promise.resolve({ data: [] as any[] }),
      creatorIds.length > 0
        ? supabase.from('profiles').select('id, full_name, username, avatar_url, is_verified').in('id', creatorIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      supabase.from('likes').select('lesson_id, user_id').in('lesson_id', lessonIds),
      supabase.from('comments').select('lesson_id').in('lesson_id', lessonIds),
      user && creatorIds.length > 0
        ? supabase.from('follows').select('following_id, status').eq('follower_id', user.id).in('following_id', creatorIds)
        : Promise.resolve({ data: [] as any[] }),
      user && creatorIds.length > 0
        ? supabase.from('follows').select('follower_id').eq('following_id', user.id).eq('status', 'accepted').in('follower_id', creatorIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    if ((creatorRes as any).error) {
      console.error('profiles fetch error:', (creatorRes as any).error)
    }

    const pMap: Record<string, TaggedProduct> = {}
    ;(productRes.data || []).forEach((p: any) => { pMap[p.id] = p })
    setProducts(pMap)

    const cMap: Record<string, CreatorInfo> = {}
    ;(creatorRes.data || []).forEach((c: any) => {
      cMap[c.id] = { full_name: c.full_name, username: c.username, avatar_url: c.avatar_url, is_verified: !!c.is_verified }
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
    ;(myFollowsRes.data || []).forEach((f: any) => { statusMap[f.following_id] = f.status })
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
    return <div className="px-4 pt-10 text-center text-stone-400 text-sm">Loading reels…</div>
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
          onOpenComments={() => setOpenCommentsFor(lesson.id)}
          onDeleted={loadLessons}
        />
      ))}
      {lessons.length === 0 && (
        <p className="text-center text-stone-400 pt-10">No reels in this category yet.</p>
      )}

      {openCommentsFor && (
        <CommentSheet
          lessonId={openCommentsFor}
          onClose={() => setOpenCommentsFor(null)}
          onCommentAdded={() => bumpCommentCount(openCommentsFor)}
        />
      )}
    </div>
  )
}

function LessonCard({
  lesson, taggedProduct, creator, liked, likeCount, commentCount,
  followStatus, creatorFollowsMe, isMe,
  onToggleLike, onToggleFollow, onOpenComments, onDeleted,
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
  onOpenComments: () => void
  onDeleted: () => void
}) {
  const router = useRouter()
  const showsQuiz = lesson.quiz_questions && lesson.quiz_questions.length > 0

  const [videoEnded, setVideoEnded] = useState(false)
  const [quizAnswered, setQuizAnswered] = useState(false)
  const [rewardGiven, setRewardGiven] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showOptions, setShowOptions] = useState(false)
  const [videoError, setVideoError] = useState(false)

  useEffect(() => {
    supabase.rpc('log_lesson_view', { p_lesson_id: lesson.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id])

  async function handleDelete() {
    if (!confirm('Ye reel delete kar dein?')) return
    await supabase.rpc('delete_lesson', { p_lesson_id: lesson.id })
    onDeleted()
  }

  function handleWhatsAppShare() {
    supabase.rpc('log_lesson_share', { p_lesson_id: lesson.id, p_channel: 'whatsapp' })
    const url = `${window.location.origin}/lesson/${lesson.id}`
    const text = encodeURIComponent(`${lesson.title} — Sthamly pe dekho: ${url}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  async function handleShare() {
    const url = `${window.location.origin}/lesson/${lesson.id}`
    if (navigator.share) {
      try {
        await navigator.share({ title: lesson.title, url })
        supabase.rpc('log_lesson_share', { p_lesson_id: lesson.id, p_channel: 'native_share' })
      } catch {
        // User cancelled the native share sheet — not an error, nothing to do.
      }
    } else {
      await navigator.clipboard.writeText(url)
      supabase.rpc('log_lesson_share', { p_lesson_id: lesson.id, p_channel: 'copy_link' })
      setToast('Link copy ho gaya')
      setTimeout(() => setToast(null), 1500)
    }
  }

  function handleAskAI() {
    router.push(`/sahayak?about=${lesson.id}`)
    setShowOptions(false)
  }

  async function handleVideoEnded() {
    if (rewardGiven) return
    setVideoEnded(true)
    if (!showsQuiz) {
      const { data, error } = await supabase.rpc('award_watch_reward', { p_lesson_id: lesson.id })
      setRewardGiven(true)
      if (!error && typeof data === 'number' && data > 0) {
        setToast(`+${data} Coins for watching`)
        setTimeout(() => setToast(null), 2000)
      }
    }
  }

  async function answerQuiz(optionIndex: number) {
    const quiz = lesson.quiz_questions[0]
    const isCorrect = optionIndex === quiz.correct_index
    setRewardGiven(true)
    if (isCorrect) {
      const { data, error } = await supabase.rpc('complete_lesson', { p_lesson_id: lesson.id })
      if (!error && typeof data === 'number') setToast(`+${data} Coins mile!`)
    } else {
      setToast('Sahi jawab dekho agli baar')
    }
    setTimeout(() => { setToast(null); setVideoEnded(false); setQuizAnswered(true) }, 1500)
  }

  function skipQuiz() {
    setVideoEnded(false)
    setRewardGiven(true)
  }

  const quiz = lesson.quiz_questions?.[0]

  const followLabel =
    followStatus === 'accepted' ? 'Following' :
    followStatus === 'requested' ? 'Requested' :
    creatorFollowsMe ? 'Follow Back' : 'Follow'

  return (
    <div className="bg-black rounded-2xl overflow-hidden shadow-sm relative">
      <div className="relative aspect-[9/16] bg-stone-900">
        {lesson.video_url && !videoError ? (
          <video
            src={lesson.video_url}
            playsInline
            controls
            onEnded={handleVideoEnded}
            onError={() => setVideoError(true)}
            className="w-full h-full object-cover"
          />
        ) : lesson.video_url && videoError ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 text-xs gap-1 px-6 text-center">
            <span>⚠️ Yeh video load nahi ho paya</span>
            <span className="text-stone-500">Shayad upload adhoora reh gaya tha</span>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm">
            1-min maker video
          </div>
        )}

        <div className="absolute top-3 left-3 right-3 flex items-center gap-2 pointer-events-none">
          <Link
            href={creator?.username ? `/creator/${creator.username}` : '#'}
            className="flex items-center gap-2 bg-black/45 rounded-full pl-1 pr-2 py-1 pointer-events-auto max-w-[70%]"
          >
            <div className="w-7 h-7 rounded-full bg-stone-300 overflow-hidden flex-shrink-0 ring-1 ring-white/30">
              {creator?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creator.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-stone-500 text-white text-xs font-bold">
                  {(creator?.full_name || creator?.username || 'U')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-white text-sm font-semibold truncate">
                {creator?.full_name || 'Creator'}
              </span>
              {creator?.username && (
                <span className="text-white/80 text-xs truncate">@{creator.username}</span>
              )}
              {creator?.is_verified && <BadgeCheck size={14} className="text-sky-400 fill-sky-400/20 flex-shrink-0" />}
            </div>
          </Link>
          {lesson.is_user_generated && lesson.creator_id && !isMe && (
            <button
              onClick={onToggleFollow}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full flex-shrink-0 whitespace-nowrap pointer-events-auto ${
                followStatus === 'accepted' || followStatus === 'requested'
                  ? 'bg-black/45 text-white border border-white/40'
                  : 'bg-white text-black'
              }`}
            >
              {followLabel}
            </button>
          )}
        </div>

        <div className="absolute bottom-4 left-3 right-16 pointer-events-none">
          <p className="text-white text-sm font-semibold drop-shadow-sm">{lesson.title}</p>
          {lesson.description && (
            <p className="text-white/85 text-xs mt-1 line-clamp-2 drop-shadow-sm">{lesson.description}</p>
          )}
          {lesson.long_form_video_url && (
            <Link
              href={`/lesson/${lesson.id}`}
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-white bg-black/40 px-2 py-1 rounded-full pointer-events-auto"
            >
              📺 {lesson.long_form_title || 'See Full Lesson'} →
            </Link>
          )}
          {taggedProduct && (
            <Link
              href="/bazaar"
              className="mt-2 flex items-center gap-2 bg-white/95 rounded-xl p-2 pointer-events-auto max-w-[220px]"
            >
              {taggedProduct.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={taggedProduct.image_url} alt="" className="w-9 h-9 rounded-lg object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-stone-800 truncate">{taggedProduct.title}</p>
                <p className="text-[11px] text-clay font-bold">₹{taggedProduct.price}</p>
              </div>
              <span className="text-[10px] font-bold bg-clay text-white px-2 py-1 rounded-full whitespace-nowrap">
                Buy
              </span>
            </Link>
          )}
        </div>

        <div className="absolute bottom-4 right-2 flex flex-col items-center gap-5 z-10">
          <button onClick={onToggleLike} className="flex flex-col items-center text-white">
            <Heart size={26} className={liked ? 'fill-red-500 text-red-500' : 'fill-none text-white'} strokeWidth={liked ? 0 : 2} />
            <span className="text-[11px] font-semibold mt-0.5 drop-shadow-sm">{likeCount}</span>
          </button>
          <button onClick={onOpenComments} className="flex flex-col items-center text-white">
            <MessageCircle size={26} strokeWidth={2} />
            <span className="text-[11px] font-semibold mt-0.5 drop-shadow-sm">{commentCount}</span>
          </button>
          <button onClick={handleWhatsAppShare} className="flex flex-col items-center">
            <WhatsAppIcon size={26} />
          </button>
          <button onClick={handleShare} className="flex flex-col items-center text-white">
            <Share2 size={24} strokeWidth={2} />
          </button>
          <div className="relative">
            <button onClick={() => setShowOptions((v) => !v)} className="flex flex-col items-center text-white">
              <MoreHorizontal size={24} strokeWidth={2} />
            </button>
            {showOptions && (
              <div className="absolute bottom-8 right-0 bg-white rounded-xl shadow-lg py-1 w-36 z-20">
                <button onClick={handleAskAI} className="w-full text-left px-3 py-2 text-xs text-stone-700">✨ Ask AI</button>
                {isMe && (
                  <button onClick={handleDelete} className="w-full text-left px-3 py-2 text-xs text-red-600">🗑️ Delete</button>
                )}
                <button onClick={() => setShowOptions(false)} className="w-full text-left px-3 py-2 text-xs text-stone-500">Cancel</button>
              </div>
            )}
          </div>
        </div>

        {videoEnded && showsQuiz && quiz && !quizAnswered && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center px-6 z-20">
            <div className="bg-clay text-white text-xs font-bold px-3 py-1 rounded-full mb-4">
              💡 Quick Question (+{lesson.points_reward} Coins)
            </div>
            <p className="text-white text-base font-semibold text-center mb-5">{quiz.question}</p>
            <div className="w-full space-y-2">
              {quiz.options.map((opt, i) => (
                <button key={i} onClick={() => answerQuiz(i)} className="w-full bg-white/95 text-stone-900 font-semibold text-sm py-3 rounded-full">
                  {opt}
                </button>
              ))}
            </div>
            <button onClick={skipQuiz} className="text-white/70 text-xs mt-4 underline">Skip</button>
          </div>
        )}

        {toast && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-mehendi text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg z-20">
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
