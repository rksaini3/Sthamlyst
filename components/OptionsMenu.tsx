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
      <button
        onClick={(e) => {
          // Prevent this from also triggering a parent card/link's own
          // click handler (e.g. card-level navigation) when this menu
          // is nested inside a clickable container.
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={`${iconClassName} p-1`}
        aria-label="Options"
      >
        <MoreVertical size={18} />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
          />
          <div className="absolute right-0 top-7 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl shadow-lg py-1 z-20 min-w-[120px]">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  onEdit()
                }}
                className="w-full text-left px-4 py-2 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  onDelete()
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
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
