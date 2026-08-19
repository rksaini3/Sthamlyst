'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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
  is_user_generated: boolean
  tagged_product_id: string | null
  long_form_video_url: string | null
  long_form_title: string | null
}

type TaggedProduct = { id: string; title: string; price: number; image_url: string | null }

export default function ReelFeed({ themeFilter }: { themeFilter?: string | null }) {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [products, setProducts] = useState<Record<string, TaggedProduct>>({})
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

      if (!error && data) {
        setLessons(data as Lesson[])

        const productIds = (data as Lesson[])
          .map((l) => l.tagged_product_id)
          .filter((id): id is string => !!id)

        if (productIds.length > 0) {
          const { data: productData } = await supabase
            .from('products')
            .select('id, title, price, image_url')
            .in('id', productIds)
          if (productData) {
            const map: Record<string, TaggedProduct> = {}
            productData.forEach((p) => { map[p.id] = p as TaggedProduct })
            setProducts(map)
          }
        }
      }
      setLoading(false)
    }
    loadLessons()
  }, [themeFilter])

  if (loading) {
    return <div className="p-6 text-center text-stone-500">Loading…</div>
  }

  return (
    <div className="px-4 pt-4 space-y-5">
      {lessons.map((lesson) => (
        <LessonCard
          key={lesson.id}
          lesson={lesson}
          taggedProduct={lesson.tagged_product_id ? products[lesson.tagged_product_id] : undefined}
        />
      ))}
      {lessons.length === 0 && (
        <p className="text-center text-stone-400 pt-10">No reels in this category yet.</p>
      )}
    </div>
  )
}

function LessonCard({ lesson, taggedProduct }: { lesson: Lesson; taggedProduct?: TaggedProduct }) {
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
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
      <div className="aspect-video bg-stone-200 flex items-center justify-center text-stone-400 text-sm">
        {lesson.video_url ? (
          <video src={lesson.video_url} controls className="w-full h-full object-cover" />
        ) : (
          '1-min maker video'
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
            {lesson.craft_theme}
          </span>
          {lesson.is_user_generated && (
            <span className="text-[10px] font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full">
              Creator Upload
            </span>
          )}
        </div>
        <h2 className="font-bold text-stone-900 mt-2">{lesson.title}</h2>
        <p className="text-sm text-stone-500 mt-1">{lesson.description}</p>

        {lesson.long_form_video_url && (
          <a
            href={lesson.long_form_video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700"
          >
            📺 {lesson.long_form_title || 'See Full Lesson'} →
          </a>
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
              <p className="text-xs text-amber-700 font-bold">₹{taggedProduct.price}</p>
            </div>
            <span className="text-[11px] font-bold bg-amber-600 text-white px-3 py-1.5 rounded-full whitespace-nowrap">
              Buy Now
            </span>
          </Link>
        )}

        {!showQuiz && result !== 'earned' && (
          <button
            onClick={() => setShowQuiz(true)}
            className="mt-3 w-full bg-amber-600 text-white font-semibold py-2.5 rounded-xl text-sm"
          >
            Take Quiz · +{lesson.points_reward} Coins
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
            ✓ +{pointsEarned} Sthamly Coins earned!
          </p>
        )}
      </div>
    </div>
  )
}
