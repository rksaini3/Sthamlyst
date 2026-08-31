'use client'

import { useEffect, useState } from 'react'
import { Heart, MessageCircle, Share2, MoreHorizontal, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

export default function ReelSideActions({
  lessonId,
  onCommentClick,
  onAskAiClick,
}: {
  lessonId: string
  onCommentClick?: () => void
  onAskAiClick?: () => void
}) {
  const { user } = useAuth()
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    loadLikes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, user?.id])

  async function loadLikes() {
    const { count, error: countError } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('lesson_id', lessonId)
    if (countError) {
      console.error('like count fetch failed:', countError)
    } else {
      setLikeCount(count ?? 0)
    }

    if (user) {
      const { data, error } = await supabase
        .from('likes')
        .select('user_id')
        .eq('lesson_id', lessonId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) {
        console.error('like status fetch failed:', error)
        return
      }
      setLiked(!!data)
    }
  }

  async function handleLike() {
    if (!user) return
    const wasLiked = liked
    // optimistic update
    setLiked(!wasLiked)
    setLikeCount((c) => (wasLiked ? c - 1 : c + 1))

    const { error } = await supabase.rpc('toggle_like', { p_lesson_id: lessonId })
    if (error) {
      // Fix: roll back the optimistic update if the RPC actually failed,
      // otherwise the heart/count can permanently disagree with the DB.
      console.error('toggle_like failed:', error)
      setLiked(wasLiked)
      setLikeCount((c) => (wasLiked ? c + 1 : c - 1))
    }
  }

  function shareToWhatsApp() {
    supabase.rpc('log_lesson_share', { p_lesson_id: lessonId, p_channel: 'whatsapp' })
    const url = `${window.location.origin}/reel/${lessonId}`
    window.open(`https://wa.me/?text=${encodeURIComponent('Ye Reel dekho Sthamly pe: ' + url)}`, '_blank')
  }

  async function shareGeneric() {
    const url = `${window.location.origin}/reel/${lessonId}`
    if (navigator.share) {
      await navigator.share({ url, title: 'Sthamly' }).catch(() => {})
      supabase.rpc('log_lesson_share', { p_lesson_id: lessonId, p_channel: 'native_share' })
    } else {
      await navigator.clipboard.writeText(url)
      supabase.rpc('log_lesson_share', { p_lesson_id: lessonId, p_channel: 'copy_link' })
    }
  }

  return (
    <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5 text-white">
      <button onClick={handleLike} className="flex flex-col items-center gap-0.5" aria-label="Like">
        <Heart size={28} className={liked ? 'fill-clay text-clay' : ''} strokeWidth={1.8} />
        <span className="text-[11px] font-semibold">{likeCount}</span>
      </button>

      <button onClick={onCommentClick} className="flex flex-col items-center gap-0.5" aria-label="Comments">
        <MessageCircle size={28} strokeWidth={1.8} />
        <span className="text-[11px] font-semibold">Comment</span>
      </button>

      <button onClick={shareToWhatsApp} className="flex flex-col items-center gap-0.5" aria-label="Share on WhatsApp">
        <span className="text-2xl leading-none">🟢</span>
        <span className="text-[11px] font-semibold">WhatsApp</span>
      </button>

      <button onClick={shareGeneric} className="flex flex-col items-center gap-0.5" aria-label="Share">
        <Share2 size={26} strokeWidth={1.8} />
        <span className="text-[11px] font-semibold">Share</span>
      </button>

      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen((v) => !v)
          }}
          aria-label="More options"
        >
          <MoreHorizontal size={26} strokeWidth={1.8} />
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(false)
              }}
            />
            <div className="absolute right-9 bottom-0 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 rounded-xl shadow-lg py-1 z-20 min-w-[140px]">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  onAskAiClick?.()
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-700"
              >
                <Sparkles size={16} className="text-dupatta" /> Ask AI
              </button>
              {/* NOTE: Save and Report are not wired up to any handler
                  yet — placeholders until that functionality exists. */}
              <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-700">
                Save
              </button>
              <button className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
                Report
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
