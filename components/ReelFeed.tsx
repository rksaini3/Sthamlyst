'use client'

import { useEffect, useState } from 'react'
import PageSkeleton from './PageSkeleton'
import ReelCard from './ReelCard'
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
  video_url: string
  craft_theme: string
  quiz_questions: QuizQuestion[]
  creator_id: string
  profiles?: {
    full_name: string | null
    username: string | null
    avatar_url: string | null
    is_verified: boolean
  } | null
}

export default function ReelFeed({ themeFilter }: { themeFilter?: string | null }) {
  const { user } = useAuth()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)

  async function loadLessons() {
    setLoading(true)
    let query = supabase
      .from('lessons')
      .select(`
        id,
        title,
        description,
        video_url,
        craft_theme,
        quiz_questions,
        creator_id,
        profiles:creator_id (
          full_name,
          username,
          avatar_url,
          is_verified
        )
      `)
      .eq('is_published', true)
      .order('order_index', { ascending: true })

    if (themeFilter) {
      query = query.eq('craft_theme', themeFilter)
    }

    const { data, error } = await query
    if (!error && data) {
      setLessons(data as unknown as Lesson[])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadLessons()
  }, [themeFilter, user])

  if (loading) {
    return <PageSkeleton rows={2} />
  }

  return (
    <div className="px-4 pt-4 space-y-5">
      {lessons.map((reel) => (
        <ReelCard
          key={reel.id}
          reel={{
            id: reel.id,
            video_url: reel.video_url,
            title: reel.title,
            description: reel.description,
            quiz_questions: reel.quiz_questions || [],
            creator_id: reel.creator_id,
            creator_name: reel.profiles?.full_name ?? null,
            creator_username: reel.profiles?.username ?? null,
            creator_avatar: reel.profiles?.avatar_url ?? null,
            creator_verified: reel.profiles?.is_verified ?? false,
          }}
        />
      ))}
      {lessons.length === 0 && (
        <p className="text-center text-stone-400 pt-10">No reels in this category yet.</p>
      )}
    </div>
  )
}
