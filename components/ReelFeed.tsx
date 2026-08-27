'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'
import { MoreVertical } from 'lucide-react'
import FollowButton from './FollowButton'
import CommentSheet from './CommentSheet'
import ShareButton from './ShareButton'

type QuizQuestion = { question: string; options: string[]; correct_index: number }

type Reel = {
  id: string
  video_url: string
  title: string
  description: string | null
  quiz_questions: QuizQuestion[]
  creator_id: string
  creator_name: string | null
  creator_username: string | null
  creator_avatar: string | null
  creator_verified: boolean
}

export default function ReelCard({
  reel,
  onDeleted,
}: {
  reel: Reel
  onDeleted?: () => void
}) {
  const { user } = useAuth()
  const router = useRouter()
  const [liked, setLiked] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [quizAnswered, setQuizAnswered] = useState(false)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [showComments, setShowComments] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const quiz = reel.quiz_questions?.[0] // 1-question quiz — final decision
  const isOwner = !!user && user.id === reel.creator_id

  function handleVideoEnded() {
    if (quiz && !quizAnswered) setShowQuiz(true)
  }

  async function handleLike() {
    if (!user) return router.push('/login')
    const { data } = await supabase.rpc('toggle_like', { p_lesson_id: reel.id })
    setLiked(!!data)
  }

  // FIX: Coins ab sirf sahi jawab pe milte hain — pehle galat jawab pe
  // bhi complete_lesson() call ho jaata thaa aur Coins mil jaate the.
  async function handleAnswer(i: number) {
    if (!user) return router.push('/login')
    setSelectedOption(i)
    if (i === quiz.correct_index) {
      await supabase.rpc('complete_lesson', { p_lesson_id: reel.id })
    }
    setQuizAnswered(true)
    setTimeout(() => setShowQuiz(false), 1500)
  }

  function handleWhatsAppShare() {
    const url = `${window.location.origin}/lesson/${reel.id}`
    const text = encodeURIComponent(`${reel.title} — Sthamly pe dekho: ${url}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  function handleRemix() {
    if (!user) return router.push('/login')
    router.push(`/upload?remixOf=${reel.id}`)
  }

  function handleAskAI() {
    setMenuOpen(false)
    router.push(`/sahayak?lessonId=${reel.id}`)
  }

  async function handleReport() {
    setMenuOpen(false)
    if (!user) return router.push('/login')
    await supabase.rpc('report_listing', { p_lesson_id: reel.id, p_reason: 'Reported from feed' })
    alert('Report bhej diya gaya, dhanyavaad.')
  }

  function handleEdit() {
    setMenuOpen(false)
    router.push(`/upload?edit=${reel.id}`)
  }

  async function handleDelete() {
    setMenuOpen(false)
    if (!confirm('Yeh reel delete karna hai?')) return
    const { error } = await supabase.rpc('delete_lesson', { p_lesson_id: reel.id })
    if (!error) {
      setDeleted(true)
      onDeleted?.()
    }
  }

  if (deleted) return null

  return (
    <div className="relative w-full aspect-[9/16] bg-black rounded-2xl overflow-hidden">
      <video
        ref={videoRef}
        src={reel.video_url}
        className="w-full h-full object-cover"
        playsInline
        autoPlay
        muted
        loop={!quiz}
        onEnded={handleVideoEnded}
      />

      {/* Top: creator info + follow + options menu */}
      <div className="absolute top-3 left-3 right-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-stone-300 overflow-hidden flex-shrink-0">
          {reel.creator_avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={reel.creator_avatar} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-white text-sm font-semibold truncate">
            {reel.creator_name ?? 'Creator'}
          </span>
          {reel.creator_username && (
            <span className="text-white/70 text-xs truncate">@{reel.creator_username}</span>
          )}
          {reel.creator_verified && <span className="text-sky-400 text-xs">✔️</span>}
        </div>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <FollowButton targetUserId={reel.creator_id} />
        </div>
      </div>

      {/* Bottom: title/description */}
      <div className="absolute bottom-4 left-3 right-16">
        <p className="text-white text-sm font-semibold">{reel.title}</p>
        {reel.description && (
          <p className="text-white/80 text-xs mt-1 line-clamp-2">{reel.description}</p>
        )}
      </div>

      {/* Right side action bar */}
      <div className="absolute bottom-4 right-2 flex flex-col items-center gap-4">
        <button onClick={handleLike} className="flex flex-col items-center text-white">
          <span className="text-2xl">{liked ? '❤️' : '🤍'}</span>
        </button>
        <button onClick={() => setShowComments(true)} className="flex flex-col items-center text-white">
          <span className="text-2xl">💬</span>
        </button>
        <button onClick={handleWhatsAppShare} className="flex flex-col items-center text-white">
          <span className="text-2xl">🟢</span>
        </button>
        <ShareButton
          url={`/lesson/${reel.id}`}
          title={reel.title}
          text={`Sthamly pe "${reel.title}" dekho`}
          className="text-white"
        />
        {/* Remix — abhi tak decision pending hai, isliye rehne diya */}
        <button onClick={handleRemix} className="flex flex-col items-center text-white">
          <span className="text-2xl">🎵</span>
        </button>

        {/* Always-visible options: Ask AI + Report, plus Edit/Delete for owner */}
        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} className="text-white p-0.5" aria-label="More options">
            <MoreVertical size={22} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-8 bottom-0 bg-white border border-stone-200 rounded-xl shadow-lg py-1 z-20 min-w-[150px]">
                <button
                  onClick={handleAskAI}
                  className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                >
                  ✨ Ask AI
                </button>
                <button
                  onClick={handleReport}
                  className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                >
                  🚩 Report
                </button>
                {isOwner && (
                  <>
                    <button
                      onClick={handleEdit}
                      className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={handleDelete}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      🗑️ Delete
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* End-screen quiz overlay */}
      {showQuiz && quiz && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center px-6">
          {!quizAnswered ? (
            <>
              <div className="bg-amber-600 text-white text-xs font-bold px-3 py-1 rounded-full mb-4">
                💡 Quick Question (+5 Coins)
              </div>
              <p className="text-white text-base font-semibold text-center mb-5">{quiz.question}</p>
              <div className="w-full space-y-2">
                {quiz.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    className="w-full bg-white/90 text-stone-800 text-sm font-medium py-3 rounded-xl"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center">
              <p className="text-4xl mb-2">{selectedOption === quiz.correct_index ? '🎉' : '👍'}</p>
              <p className="text-white font-semibold">
                {selectedOption === quiz.correct_index ? '+5 Coins mile!' : 'Sahi jawab dekho agli baar'}
              </p>
            </div>
          )}
        </div>
      )}

      {showComments && (
        <CommentSheet lessonId={reel.id} onClose={() => setShowComments(false)} />
      )}
    </div>
  )
}