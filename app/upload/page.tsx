'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

type MyProduct = { id: string; title: string }

export default function UploadReelPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [craftTheme, setCraftTheme] = useState('Clay Crafts & Home Decor')
  const [q1, setQ1] = useState('')
  const [q1Options, setQ1Options] = useState(['', '', ''])
  const [q1Correct, setQ1Correct] = useState(0)
  const [q2, setQ2] = useState('')
  const [q2Options, setQ2Options] = useState(['', '', ''])
  const [q2Correct, setQ2Correct] = useState(0)
  const [taggedProductId, setTaggedProductId] = useState('')
  const [myProducts, setMyProducts] = useState<MyProduct[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading || !user) return
    async function loadMyProducts() {
      const { data } = await supabase
        .from('products')
        .select('id, title')
        .eq('maker_id', user!.id)
      if (data) setMyProducts(data as MyProduct[])
    }
    loadMyProducts()
  }, [authLoading, user])

  async function handleSubmit() {
    setError('')
    if (!videoFile || !title || !q1 || !q2) {
      setError('Video, title, aur dono quiz questions bharo.')
      return
    }
    setUploading(true)

    if (!user) {
      setError('Pehle sign in karo.')
      setUploading(false)
      router.push('/login')
      return
    }

    const filePath = `${user.id}/${Date.now()}-${videoFile.name}`
    const { error: uploadError } = await supabase.storage.from('reels').upload(filePath, videoFile)
    if (uploadError) {
      setError('Video upload fail: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: publicUrlData } = supabase.storage.from('reels').getPublicUrl(filePath)

    const quizQuestions = [
      { question: q1, options: q1Options.filter(Boolean), correct_index: q1Correct },
      { question: q2, options: q2Options.filter(Boolean), correct_index: q2Correct },
    ]

    const { error: rpcError } = await supabase.rpc('create_reel', {
      p_title: title,
      p_description: description,
      p_video_url: publicUrlData.publicUrl,
      p_craft_theme: craftTheme,
      p_quiz_questions: quizQuestions,
      p_tagged_product_id: taggedProductId || null,
    })

    setUploading(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    router.push('/learn')
  }

  return (
    <div className="max-w-md mx-auto pb-24 px-4 pt-6">
      <h1 className="text-xl font-bold text-amber-900">Upload a Reel</h1>
      <p className="text-xs text-stone-500 mt-1">
        1-min video + a 2-question quiz. Viewers earn points, and can buy your tagged product.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="text-sm font-semibold text-stone-800">Video</label>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm mt-1"
          />
        </div>

        <Field label="Title" value={title} onChange={setTitle} placeholder="How I hand-paint clay diyas" />
        <Field label="Description" value={description} onChange={setDescription} placeholder="Short description" />

        <div>
          <label className="text-sm font-semibold text-stone-800">Craft theme</label>
          <select
            value={craftTheme}
            onChange={(e) => setCraftTheme(e.target.value)}
            className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm mt-1"
          >
            <option>Clay Crafts & Home Decor</option>
            <option>Handwoven Baskets</option>
            <option>Painting & Art</option>
            <option>Jute Bags</option>
          </select>
        </div>

        <QuizBuilder
          label="Question 1"
          question={q1} setQuestion={setQ1}
          options={q1Options} setOptions={setQ1Options}
          correct={q1Correct} setCorrect={setQ1Correct}
        />
        <QuizBuilder
          label="Question 2"
          question={q2} setQuestion={setQ2}
          options={q2Options} setOptions={setQ2Options}
          correct={q2Correct} setCorrect={setQ2Correct}
        />

        {myProducts.length > 0 && (
          <div>
            <label className="text-sm font-semibold text-stone-800">Tag a product (optional)</label>
            <select
              value={taggedProductId}
              onChange={(e) => setTaggedProductId(e.target.value)}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm mt-1"
            >
              <option value="">None</option>
              {myProducts.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="w-full bg-amber-600 text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Publish Reel'}
        </button>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-sm font-semibold text-stone-800">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm mt-1"
      />
    </div>
  )
}

function QuizBuilder({
  label, question, setQuestion, options, setOptions, correct, setCorrect,
}: {
  label: string
  question: string
  setQuestion: (v: string) => void
  options: string[]
  setOptions: (v: string[]) => void
  correct: number
  setCorrect: (v: number) => void
}) {
  return (
    <div className="border border-stone-200 rounded-xl p-3">
      <p className="text-sm font-semibold text-stone-800 mb-2">{label}</p>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Question text"
        className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm mb-2"
      />
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2 mb-1.5">
          <input
            type="radio"
            checked={correct === i}
            onChange={() => setCorrect(i)}
            title="Mark as correct answer"
          />
          <input
            value={opt}
            onChange={(e) => {
              const next = [...options]
              next[i] = e.target.value
              setOptions(next)
            }}
            placeholder={`Option ${i + 1}`}
            className="flex-1 border border-stone-300 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
      ))}
      <p className="text-[11px] text-stone-400">Select the radio button next to the correct answer.</p>
    </div>
  )
}
