'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type QuizQuestion = { question: string; options: string[]; correct_index: number }

export default function QuickQuizOverlay({
  lessonId,
  questions,
  pointsReward,
  onDone,
}: {
  lessonId: string
  questions: QuizQuestion[]
  pointsReward: number
  onDone?: (earned: number) => void
}) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [finished, setFinished] = useState(false)
  const [earned, setEarned] = useState(0)
  const [touchStartY, setTouchStartY] = useState<number | null>(null)

  if (!questions?.length || finished) {
    return finished ? (
      <div className="absolute inset-x-0 bottom-24 flex justify-center pointer-events-none">
        <div className="bg-turmeric text-white text-sm font-bold px-4 py-2 rounded-full animate-bounce">
          🪙 +{earned} Coins!
        </div>
      </div>
    ) : null
  }

  const q = questions[index]

  async function selectAnswer(i: number) {
    if (picked !== null) return
    setPicked(i)

    const isLast = index === questions.length - 1
    setTimeout(async () => {
      if (isLast) {
        const { data, error } = await supabase.rpc('complete_lesson', { p_lesson_id: lessonId })
        const points = error ? 0 : (data as number) ?? pointsReward
        setEarned(points)
        setFinished(true)
        onDone?.(points)
      } else {
        setIndex((v) => v + 1)
        setPicked(null)
      }
    }, 450) // brief pause so the tap/correct feedback is visible
  }

  // Simplified swipe: swipe down = skip the quiz without answering.
  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartY(e.touches[0].clientY)
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartY === null) return
    const dy = e.changedTouches[0].clientY - touchStartY
    if (dy > 60) setFinished(true) // swiped down -> dismiss, no points
    setTouchStartY(null)
  }

  return (
    <div
      className="absolute inset-x-4 bottom-24 bg-white/95 dark:bg-stone-900/95 backdrop-blur rounded-2xl p-4 shadow-xl"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <p className="text-xs font-bold text-clay mb-2">
        💡 Quick Question (+{pointsReward} Coins)
      </p>
      <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-3">{q.question}</p>
      <div className="flex flex-col gap-2">
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correct_index
          const showState = picked !== null
          const stateClass =
            showState && i === picked
              ? isCorrect
                ? 'bg-mehendi text-white'
                : 'bg-red-500 text-white'
              : showState && isCorrect
              ? 'bg-mehendi-light text-mehendi'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200'
          return (
            <button
              key={i}
              onClick={() => selectAnswer(i)}
              disabled={picked !== null}
              className={`text-left text-sm font-medium px-3 py-2 rounded-xl ${stateClass}`}
            >
              {opt}
            </button>
          )
        })}
      </div>
      <p className="text-[10px] text-stone-400 mt-2 text-center">Neeche swipe karke skip karo</p>
    </div>
  )
}