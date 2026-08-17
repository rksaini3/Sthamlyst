'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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
}

export default function LearnPage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadLessons() {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('is_published', true)
        .order('order_index', { ascending: true })

      if (!error && data) setLessons(data as Lesson[])
      setLoading(false)
    }
    loadLessons()
  }, [])

  if (loading) {
    return <div className="p-6 text-center text-stone-500">Loading lessons…</div>
  }

  return (
    <div className="max-w-md mx-auto pb-24">
      <header className="sticky top-0 bg-amber-50/95 backdrop-blur px-4 py-4 border-b border-amber-100 z-10">
        <h1 className="text-xl font-bold text-amber-900">Learn &amp; Earn</h1>
        <p className="text-xs text-amber-700 mt-0.5">Watch local makers, answer 2 questions, earn Sthamly Points</p>
      </header>

      <div className="px-4 pt-4 space-y-5">
        {lessons.map((lesson) => (
          <LessonCard key={lesson.id} lesson={lesson} />
        ))}
        {lessons.length === 0 && (
          <p className="text-center text-stone-400 pt-10">No lessons published yet.</p>
        )}
      </div>
    </div>
  )
}

function LessonCard({ lesson }: { lesson: Lesson }) {
  const [showQuiz, setShowQuiz] = useState(false)
  const [answers, setAnswers] = useState<number[]>([])
  const [result, setResult] = useState<'idle' | 'correct' | 'wrong' | 'earned'>('idle')
  const [pointsEarned, setPointsEarned] = useState(0)

  function selectAnswer(qIndex: number, optIndex: number) {
    const next = [...answers]
    next[qIndex] = optIndex
    setAnswers(next)
  }

  async function submitQuiz() {
    const allCorrect = lesson.quiz_questions.every(
      (q, i) => answers[i] === q.correct_index
    )
    if (!allCorrect) {
      setResult('wrong')
      return
    }
    setResult('correct')

    const { data, error } = await supabase.rpc('complete_lesson', {
      p_lesson_id: lesson.id,
    })
    if (!error && typeof data === 'number') {
      setPointsEarned(data)
      setResult('earned')
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-amber-100 overflow-hidden shadow-sm">
      <div className="aspect-video bg-stone-200 flex items-center justify-center text-stone-400 text-sm">
        {lesson.video_url ? (
          <video src={lesson.video_url} controls className="w-full h-full object-cover" />
        ) : (
          '1-min maker video'
        )}
      </div>

      <div className="p-4">
        <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
          {lesson.craft_theme}
        </span>
        <h2 className="font-bold text-stone-900 mt-2">{lesson.title}</h2>
        <p className="text-sm text-stone-500 mt-1">{lesson.description}</p>

        {!showQuiz && result !== 'earned' && (
          <button
            onClick={() => setShowQuiz(true)}
            className="mt-3 w-full bg-amber-600 text-white font-semibold py-2.5 rounded-xl text-sm"
          >
            Take Quiz · +{lesson.points_reward} points
          </button>
        )}

        {showQuiz && result !== 'earned' && (
          <div className="mt-3 space-y-3">
            {lesson.quiz_questions.map((q, qi) => (
              <div key={qi}>
                <p className="text-sm font-medium text-stone-800">{q.question}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => selectAnswer(qi, oi)}
                      className={`text-xs px-3 py-1.5 rounded-full border ${
                        answers[qi] === oi
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'border-stone-300 text-stone-600'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {result === 'wrong' && (
              <p className="text-xs text-red-600">Not quite — check the video again and retry.</p>
            )}

            <button
              onClick={submitQuiz}
              disabled={answers.length < lesson.quiz_questions.length}
              className="w-full bg-stone-900 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-40"
            >
              Submit Answers
            </button>
          </div>
        )}

        {result === 'earned' && (
          <p className="mt-3 text-sm font-semibold text-green-700 bg-green-50 rounded-xl px-3 py-2 text-center">
            ✓ +{pointsEarned} Sthamly Points earned!
          </p>
        )}
      </div>
    </div>
  )
}
