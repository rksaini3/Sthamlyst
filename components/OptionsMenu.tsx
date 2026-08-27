'use client'

import { useState } from 'react'
import { MoreVertical } from 'lucide-react'

export default function OptionsMenu({
  isOwner, onEdit, onDelete, deleteLabel = 'Delete', iconClassName = 'text-stone-400',
}: {
  isOwner: boolean
  onEdit?: () => void
  onDelete?: () => void
  deleteLabel?: string
  iconClassName?: string
}) {
  const [open, setOpen] = useState(false)

  if (!isOwner) return null

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className={`${iconClassName} p-1`} aria-label="Options">
        <MoreVertical size={18} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 bg-white border border-stone-200 rounded-xl shadow-lg py-1 z-20 min-w-[120px]">
            {onEdit && (
              <button
                onClick={() => { setOpen(false); onEdit() }}
                className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => { setOpen(false); onDelete() }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                {deleteLabel}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}