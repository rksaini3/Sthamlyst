'use client'

import { useState } from 'react'
import { Smile } from 'lucide-react'

const EMOJIS = [
  '😀', '😂', '🥰', '😍', '😊', '👍', '🙏', '🔥',
  '❤️', '🎉', '😢', '😮', '👏', '💪', '🙌', '✨',
  '🪔', '🏺', '🧺', '🎨', '👜', '💰', '🛍️', '📿',
]

export default function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="text-stone-500 p-1" aria-label="Emoji">
        <Smile size={20} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-9 right-0 bg-white border border-stone-200 rounded-xl shadow-lg p-2 z-20 grid grid-cols-8 gap-1 w-64">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => { onSelect(e); setOpen(false) }}
                className="text-lg hover:bg-stone-100 rounded p-1"
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
