'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Lesson = {
  id: string
  title: string
  description: string | null
  craft_theme: string
  long_form_video_url: string | null
  long_form_title: string | null
  creator_id: string | null
}

type OtherReel = { id: string; title: string; video_url: string | null }

export default function LessonPage() {
  const params = useParams()
  const lessonId = params.id as string
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [otherReels, setOtherReels] = useState<OtherReel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('lessons')
        .select('id, title, description, craft_theme, long_form_video_url, long_form_title, creator_id')
        .eq('id', lessonId)
        .single()

      if (data) {
        setLesson(data as Lesson)
        if (data.creator_id) {
          const { data: others } = await supabase
            .from('lessons')
            .select('id, title, video_url')
            .eq('creator_id', data.creator_id)
            .eq('is_published', true)
            .neq('id', lessonId)
            .limit(6)
          if (others) setOtherReels(others as OtherReel[])
        }
      }
      setLoading(false)
    }
    load()
  }, [lessonId])

  if (loading) return <div className="p-6 text-center text-stone-500">Loading…</div>
  if (!lesson) return <div className="p-6 text-center text-stone-500">Lesson not found.</div>

  return (
    <div className="max-w-md mx-auto pb-24 min-h-dvh">
      <header className="sticky top-0 bg-white/95 backdrop-blur px-4 py-3 border-b border-stone-100 z-10 flex items-center gap-3">
        <Link href="/"><ArrowLeft size={22} className="text-stone-800" /></Link>
        <span className="text-sm font-semibold text-stone-900">Full Lesson</span>
      </header>

      <div className="aspect-video bg-stone-900">
        {lesson.long_form_video_url ? (
          <video src={lesson.long_form_video_url} controls className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm">
            No long-form video yet
          </div>
        )}
      </div>

      <div className="p-4">
        <span className="text-[10px] font-semibold text-turmeric bg-turmeric-light px-2 py-0.5 rounded-full">
          {lesson.craft_theme}
        </span>
        <h1 className="text-lg font-heading font-semibold text-stone-900 mt-2">
          {lesson.long_form_title || lesson.title}
        </h1>
        <p className="text-sm text-stone-600 mt-2">{lesson.description}</p>
      </div>

      {otherReels.length > 0 && (
        <div className="px-4 pt-2">
          <h2 className="text-sm font-bold text-stone-800 mb-2">More from this creator</h2>
          <div className="grid grid-cols-3 gap-2">
            {otherReels.map((r) => (
              <div key={r.id} className="aspect-[9/16] bg-stone-200 rounded-lg overflow-hidden">
                {r.video_url && (
                  <video src={r.video_url} className="w-full h-full object-cover" muted />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
