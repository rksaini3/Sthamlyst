'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Settings, History, GraduationCap, Lightbulb, TrendingUp, BadgeCheck, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Insights = {
  views: number
  interactions: number
  new_followers: number
  content_shared: number
  period_days: number
}

export default function ProfessionalDashboard({ onClose }: { onClose: () => void }) {
  const [insights, setInsights] = useState<Insights | null>(null)

  useEffect(() => {
    supabase.rpc('get_profile_insights', { p_days: 30 }).then(({ data }) => {
      if (data) setInsights(data as Insights)
    })
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-stone-900 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-stone-800">
        <button onClick={onClose}><ArrowLeft size={20} /></button>
        <span className="font-bold text-base">Professional dashboard</span>
        <Link href="/settings"><Settings size={20} /></Link>
      </div>

      <div className="px-4 py-4">
        <h2 className="text-lg font-bold">Insights</h2>
        <p className="text-xs text-stone-400 mb-3">Last {insights?.period_days ?? 30} days</p>

        <InsightRow label="Views" value={insights?.views ?? 0} />
        <InsightRow label="Interactions" value={insights?.interactions ?? 0} />
        <InsightRow label="New followers" value={insights?.new_followers ?? 0} />
        <InsightRow label="Content you shared" value={insights?.content_shared ?? 0} />
      </div>

      <div className="px-4 py-4 border-t border-stone-100 dark:border-stone-800">
        <h2 className="text-lg font-bold mb-3">Your tools</h2>
        <ToolRow icon={<History size={20} />} title="Monthly recap" desc="See what you made happen last month." tag="New" />
        <ToolRow icon={<GraduationCap size={20} />} title="Best practices" tag="New" />
        <ToolRow icon={<Lightbulb size={20} />} title="Inspiration" />
        <ToolRow icon={<TrendingUp size={20} />} title="Ad tools" />
        <ToolRow icon={<BadgeCheck size={20} />} title="Branded content" />
        <ToolRow icon={<Send size={20} />} title="Saved replies" desc="Save replies to common questions" />
      </div>
    </div>
  )
}

function InsightRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-stone-100 dark:border-stone-800">
      <span className="text-sm text-stone-700 dark:text-stone-300">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  )
}

function ToolRow({ icon, title, desc, tag }: { icon: React.ReactNode; title: string; desc?: string; tag?: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="text-stone-500">{icon}</div>
      <div className="flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {desc && <p className="text-xs text-stone-400">{desc}</p>}
      </div>
      {tag && <span className="bg-indigobrand text-white text-[10px] font-bold px-2 py-1 rounded-full">{tag}</span>}
    </div>
  )
}