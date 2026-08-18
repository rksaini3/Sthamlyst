'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Lesson = {
  id: string
  title: string
  description?: string
  video_url: string
  craft_theme: string
  quiz_questions: any[]
  points_reward: number
  is_published: boolean
  creator_id?: string
  creator_name?: string
}

export default function LearnPage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [userPoints, setUserPoints] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Fetch lessons
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('*, profiles:creator_id(full_name)')
        .eq('is_published', true)
        .order('created_at', { ascending: false })

      if (lessonsData) {
        const mapped = lessonsData.map((l: any) => ({
          ...l,
          creator_name: l.profiles?.full_name || 'Sthamly',
        }))
        setLessons(mapped)
      }

      // Fetch user points
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('sthamly_points')
          .eq('id', user.id)
          .single()
        if (profile) setUserPoints(profile.sthamly_points)
      }

      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <div className="p-6 text-center text-stone-500">Loading lessons…</div>
  }

  return (
    <div className="max-w-md mx-auto pb-24">
      <header className="sticky top-0 bg-amber-50/95 backdrop-blur px-4 py-4 border-b border-amber-100 z-10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-amber-900">Learn & Earn</h1>
          <p className="text-xs text-amber-700 mt-0.5">Watch & earn Sthamly Points</p>
        </div>
        <span className="text-xs font-bold bg-amber-600 text-white px-3 py-1.5 rounded-full whitespace-nowrap">
          🪙 {userPoints} pts
        </span>
      </header>

      <div className="px-4 pt-4 grid grid-cols-1 gap-4">
        {lessons.map((lesson) => (
          <LessonCard key={lesson.id} lesson={lesson} />
        ))}
        {lessons.length === 0 && (
          <p className="text-center text-stone-400 pt-10">No lessons available yet.</p>
        )}
      </div>
    </div>
  )
}

function LessonCard({ lesson }: { lesson: Lesson }) {
  const [showQuiz, setShowQuiz] = useState(false)
  const [answered, setAnswered] = useState(false)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [answering, setAnswering] = useState(false)

  async function handleAnswer(optionIndex: number) {
    if (!lesson.quiz_questions || lesson.quiz_questions.length === 0) {
      setAnswered(true)
      setPointsEarned(lesson.points_reward)
      return
    }

    setAnswering(true)

    // Get first quiz question
    const question = lesson.quiz_questions[0]
    const isCorrect = optionIndex === question.correct_answer

    if (isCorrect) {
      // Award points
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.rpc('complete_lesson', {
          p_lesson_id: lesson.id,
        })
      }
      setPointsEarned(lesson.points_reward)
    }

    setAnswered(true)
    setAnswering(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-amber-100 overflow-hidden shadow-sm">
      {/* Video Thumbnail */}
      <div className="w-full h-[280px] bg-stone-900 relative group cursor-pointer" onClick={() => setShowQuiz(true)}>
        {lesson.video_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img 
            src={lesson.video_url} 
            alt={lesson.title} 
            className="w-full h-full object-cover group-hover:opacity-75 transition" 
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
          <div className="bg-amber-600 text-white rounded-full p-4">
            ▶
          </div>
        </div>
        <span className="absolute top-3 right-3 bg-amber-600 text-white text-xs font-bold px-2 py-1 rounded-full">
          +{lesson.points_reward} pts
        </span>
      </div>

      <div className="p-4">
        {/* Creator Info */}
        <p className="text-[11px] text-stone-500">
          by <span className="font-semibold text-stone-700">{lesson.creator_name}</span> · {lesson.craft_theme}
        </p>

        {/* Title */}
        <h2 className="font-bold text-stone-900 mt-2 line-clamp-2">{lesson.title}</h2>

        {/* Description */}
        {lesson.description && (
          <p className="text-sm text-stone-500 mt-1 line-clamp-2">{lesson.description}</p>
        )}

        {/* Quiz Section */}
        {showQuiz && !answered && lesson.quiz_questions && lesson.quiz_questions.length > 0 && (
          <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <p className="font-semibold text-stone-900 mb-3 text-sm">
              {lesson.quiz_questions[0].question}
            </p>
            <div className="grid grid-cols-1 gap-2">
              {lesson.quiz_questions[0].options?.map((option: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={answering}
                  className="p-2.5 text-left text-sm font-medium border border-amber-300 rounded-lg hover:bg-amber-100 transition disabled:opacity-50"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Success Message */}
        {answered && pointsEarned > 0 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-center">
            <p className="text-green-700 font-bold">✓ Correct!</p>
            <p className="text-sm text-green-600 mt-1">
              +{pointsEarned} Sthamly Points earned
            </p>
          </div>
        )}

        {/* CTA Button */}
        <button
          onClick={() => setShowQuiz(true)}
          disabled={answered}
          className={`w-full mt-4 py-2.5 rounded-xl font-semibold text-sm transition ${
            answered
              ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
              : 'bg-amber-600 text-white hover:bg-amber-700'
          }`}
        >
          {answered ? '✓ Completed' : 'Watch & Answer Quiz'}
        </button>
      </div>
    </div>
  )
}
