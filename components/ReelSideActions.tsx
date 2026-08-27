'use client'

import { useEffect, useState } from 'react'
import { Heart, MessageCircle, Share2, MoreHorizontal, Sparkles, Mic } from 'lucide-react'
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
  }, [lessonId, user?.id])

  async function loadLikes() {
    const { count } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('lesson_id', lessonId)
    setLikeCount(count ?? 0)

    if (user) {
      const { data } = await supabase
        .from('likes')
        .select('user_id')
        .eq('lesson_id', lessonId)
        .eq('user_id', user.id)
        .maybeSingle()
      setLiked(!!data)
    }
  }

  async function handleLike() {
    if (!user) return
    setLiked((v) => !v) // optimistic
    setLikeCount((c) => (liked ? c - 1 : c + 1))
    await supabase.rpc('toggle_like', { p_lesson_id: lessonId })
  }

  function shareToWhatsApp() {
    const url = `${window.location.origin}/reel/${lessonId}`
    window.open(`https://wa.me/?text=${encodeURIComponent('Ye Reel dekho Sthamly pe: ' + url)}`, '_blank')
  }

  async function shareGeneric() {
    const url = `${window.location.origin}/reel/${lessonId}`
    if (navigator.share) {
      await navigator.share({ url, title: 'Sthamly' }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(url)
    }
  }

  return (
    <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5 text-white">
      <button onClick={handleLike} className="flex flex-col items-center gap-0.5">
        <Heart size={28} className={liked ? 'fill-clay text-clay' : ''} strokeWidth={1.8} />
        <span className="text-[11px] font-semibold">{likeCount}</span>
      </button>

      <button onClick={onCommentClick} className="flex flex-col items-center gap-0.5">
        <MessageCircle size={28} strokeWidth={1.8} />
        <span className="text-[11px] font-semibold">Comment</span>
      </button>

      <button onClick={shareToWhatsApp} className="flex flex-col items-center gap-0.5">
        <span className="text-2xl leading-none">🟢</span>
        <span className="text-[11px] font-semibold">WhatsApp</span>
      </button>

      <button onClick={shareGeneric} className="flex flex-col items-center gap-0.5">
        <Share2 size={26} strokeWidth={1.8} />
        <span className="text-[11px] font-semibold">Share</span>
      </button>

      <div className="relative">
        <button onClick={() => setMenuOpen((v) => !v)}>
          <MoreHorizontal size={26} strokeWidth={1.8} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-9 bottom-0 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 rounded-xl shadow-lg py-1 z-20 min-w-[140px]">
              <button
                onClick={() => { setMenuOpen(false); onAskAiClick?.() }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-700"
              >
                <Sparkles size={16} className="text-dupatta" /> Ask AI
              </button>
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