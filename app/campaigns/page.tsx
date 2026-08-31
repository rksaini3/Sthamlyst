'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

type Campaign = {
  id: string
  title: string
  description: string | null
  category: string | null
  budget: number | null
  created_at: string
  profiles: { full_name: string | null } | null
}

export default function CampaignsPage() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [budget, setBudget] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [respondError, setRespondError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setLoadError('')
    const { data, error: fetchError } = await supabase
      .from('campaign_requests')
      .select('id, title, description, category, budget, created_at, profiles:business_id ( full_name )')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(50)

    if (fetchError) {
      setLoadError('Campaigns load nahi ho payi: ' + fetchError.message)
      setCampaigns([])
    } else {
      setCampaigns((data as unknown as Campaign[]) || [])
    }
    setLoading(false)
  }

  function validateBudget(raw: string): number | null | 'invalid' {
    if (!raw.trim()) return null // budget optional
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return 'invalid'
    return n
  }

  async function handlePost() {
    setError('')
    if (!title.trim()) {
      setError('Title zaroori hai.')
      return
    }

    const parsedBudget = validateBudget(budget)
    if (parsedBudget === 'invalid') {
      setError('Budget ek valid, non-negative number hona chahiye.')
      return
    }

    setPosting(true)
    const { error: rpcError } = await supabase.rpc('post_campaign_request', {
      p_title: title.trim(),
      p_description: description.trim() || null,
      p_category: category.trim() || null,
      p_budget: parsedBudget,
    })
    setPosting(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    setTitle('')
    setDescription('')
    setCategory('')
    setBudget('')
    setShowForm(false)
    load()
  }

  async function respond(campaignId: string) {
    const message = prompt('Business ko kya message bhejna hai?')
    if (!message || !message.trim()) return

    setRespondError('')
    setRespondingId(campaignId)
    const { error: rpcError } = await supabase.rpc('respond_to_campaign', {
      p_campaign_id: campaignId,
      p_message: message.trim(),
    })
    setRespondingId(null)

    if (rpcError) {
      setRespondError('Response bhejne mein error: ' + rpcError.message)
      return
    }
    alert('Response bhej diya!')
  }

  return (
    <div className="max-w-md mx-auto pb-24 px-4 pt-6 min-h-dvh">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-heading font-semibold text-clay">Campaigns</h1>
        {user && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="text-xs font-semibold bg-clay text-white px-3 py-1.5 rounded-full"
          >
            + Post Campaign
          </button>
        )}
      </div>
      <p className="text-xs text-stone-500 mt-1">
        Businesses find local creators for campaigns — creators respond directly.
      </p>

      {showForm && (
        <div className="mt-4 border border-stone-200 rounded-xl p-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Campaign title (e.g. Diwali photography)"
            className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What do you need?"
            rows={2}
            className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
              className="flex-1 border border-stone-300 rounded-xl px-3 py-2 text-sm"
            />
            <input
              type="number"
              min="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Budget ₹"
              className="flex-1 border border-stone-300 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={handlePost}
            disabled={posting}
            className="w-full bg-clay text-white font-semibold py-2 rounded-xl text-sm disabled:opacity-50"
          >
            {posting ? 'Posting…' : 'Post Campaign'}
          </button>
          <p className="text-[10px] text-stone-400">
            Note: needs Business mode ON (Settings) — Business mode toggle coming soon; ask an admin
            to enable `is_business` for now if this fails.
          </p>
        </div>
      )}

      {respondError && <p className="text-xs text-red-600 mt-3">{respondError}</p>}

      <div className="mt-4 space-y-3">
        {loading && <p className="text-center text-stone-400 text-sm">Loading…</p>}
        {loadError && <p className="text-center text-red-500 text-sm">{loadError}</p>}

        {campaigns.map((c) => (
          <div key={c.id} className="border border-stone-200 rounded-xl p-3">
            <p className="text-sm font-bold text-stone-900">{c.title}</p>
            <p className="text-xs text-stone-500 mt-1">{c.description}</p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[11px] text-stone-400">
                {c.category} {c.budget ? `· ₹${c.budget}` : ''} · by {c.profiles?.full_name || 'Business'}
              </p>
              {user && (
                <button
                  onClick={() => respond(c.id)}
                  disabled={respondingId === c.id}
                  className="text-xs font-semibold text-clay disabled:opacity-50"
                >
                  {respondingId === c.id ? 'Sending…' : 'Respond →'}
                </button>
              )}
            </div>
          </div>
        ))}
        {!loading && !loadError && campaigns.length === 0 && (
          <p className="text-center text-stone-400 text-sm pt-6">No open campaigns right now.</p>
        )}
      </div>
    </div>
  )
}