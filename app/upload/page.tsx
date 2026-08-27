'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as tus from 'tus-js-client'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

// SETUP NEEDED: npm install tus-js-client
// This switches video uploads from a single big PUT request to a
// resumable, chunked upload — Supabase Storage supports this via the
// TUS protocol. On a flaky mobile connection, a normal upload has to
// restart completely from zero if the connection blips even once;
// a TUS upload resumes from wherever it left off, and we can show a
// real progress bar so it's clear it's actually working instead of
// looking frozen.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

type MyProduct = { id: string; title: string }

function uploadViaTus(
  file: File,
  bucket: string,
  path: string,
  accessToken: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000, 15000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-upsert': 'true',
      },
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: file.type || 'video/mp4',
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024, // 6MB per chunk — required by Supabase's TUS endpoint
      onError: (error) => reject(error),
      onProgress: (bytesUploaded, bytesTotal) => {
        onProgress(Math.round((bytesUploaded / bytesTotal) * 100))
      },
      onSuccess: () => resolve(),
    })

    // Resume an interrupted upload of the same file if one exists,
    // instead of starting over from 0%.
    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0])
      }
      upload.start()
    })
  })
}

export default function UploadReelPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [craftTheme, setCraftTheme] = useState('Clay Crafts & Home Decor')

  // Single optional quiz — matches the product spec ("Single Quiz
  // Switch: Add 1 Quiz to Reel?"), not a mandatory 2-question form.
  const [addQuiz, setAddQuiz] = useState(false)
  const [q1, setQ1] = useState('')
  const [q1Options, setQ1Options] = useState(['', '', ''])
  const [q1Correct, setQ1Correct] = useState(0)

  const [taggedProductId, setTaggedProductId] = useState('')
  const [longFormFile, setLongFormFile] = useState<File | null>(null)
  const [longFormTitle, setLongFormTitle] = useState('')
  const [myProducts, setMyProducts] = useState<MyProduct[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
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

    if (!videoFile || !title) {
      setError('Video aur title dono zaroori hain.')
      return
    }
    if (addQuiz && (!q1 || q1Options.filter(Boolean).length < 2)) {
      setError('Quiz on hai to sawaal aur kam se kam 2 options bharo, ya quiz switch off kar do.')
      return
    }

    if (!user) {
      setError('Pehle sign in karo.')
      router.push('/login')
      return
    }

    // Supabase Storage's per-project default file size limit is 50MB
    // on the free tier (can be raised in Dashboard -> Storage -> your
    // bucket -> settings if needed later for longer reels).
    const MAX_MB = 45
    if (videoFile.size > MAX_MB * 1024 * 1024) {
      setError(
        `Ye video ${(videoFile.size / (1024 * 1024)).toFixed(1)}MB ki hai — ${MAX_MB}MB se choti honi chahiye. Phone camera settings mein resolution kam karo, ya kisi video-compress app se chhota karke dobara try karo.`
      )
      return
    }

    setUploading(true)

    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) {
      setError('Session expire ho gaya, dobara login karo.')
      setUploading(false)
      router.push('/login')
      return
    }

    const filePath = `${user.id}/${Date.now()}-${videoFile.name}`

    try {
      setProgressLabel('Reel upload ho raha hai...')
      await uploadViaTus(videoFile, 'reels', filePath, accessToken, setProgress)
    } catch (e: any) {
      setError(
        'Upload beech mein ruk gaya — internet connection check karo (WiFi ya strong 4G) aur "Publish Reel" dobara dabao, yeh wahi se resume karega jahan ruka tha.'
      )
      setUploading(false)
      return
    }

    const { data: publicUrlData } = supabase.storage.from('reels').getPublicUrl(filePath)

    // Optional long-form video — a normal 16:9 deeper lesson, uploaded
    // separately from the short 9:16 reel.
    let longFormUrl: string | null = null
    if (longFormFile) {
      const LONG_MAX_MB = 200
      if (longFormFile.size > LONG_MAX_MB * 1024 * 1024) {
        setError(`Long-form video ${LONG_MAX_MB}MB se choti honi chahiye.`)
        setUploading(false)
        return
      }
      const longPath = `${user.id}/long-${Date.now()}-${longFormFile.name}`
      try {
        setProgress(0)
        setProgressLabel('Long-form video upload ho raha hai...')
        await uploadViaTus(longFormFile, 'reels', longPath, accessToken, setProgress)
      } catch (e: any) {
        setError('Long-form video upload fail ho gaya, dobara try karo.')
        setUploading(false)
        return
      }
      const { data: longUrlData } = supabase.storage.from('reels').getPublicUrl(longPath)
      longFormUrl = longUrlData.publicUrl
    }

    setProgressLabel('Reel publish ho raha hai...')

    const quizQuestions = addQuiz && q1
      ? [{ question: q1, options: q1Options.filter(Boolean), correct_index: q1Correct }]
      : []

    const { error: rpcError } = await supabase.rpc('create_reel', {
      p_title: title,
      p_description: description,
      p_video_url: publicUrlData.publicUrl,
      p_craft_theme: craftTheme,
      p_quiz_questions: quizQuestions,
      p_tagged_product_id: taggedProductId || null,
      p_long_form_video_url: longFormUrl,
      p_long_form_title: longFormTitle || null,
    })

    setUploading(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    router.push('/')
  }

  return (
    <div className="max-w-md mx-auto pb-24 px-4 pt-6">
      <h1 className="text-xl font-bold text-clay">Upload a Reel</h1>
      <p className="text-xs text-stone-500 mt-1">
        1-min video. Ek optional quiz laga sakte ho, viewers points kamate hain aur tagged product khareed sakte hain.
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
          <p className="text-[11px] text-stone-400 mt-1">
            Under 45MB works best (a 1-min clip at normal quality).
          </p>
          {videoFile && (
            <p className="text-[11px] text-stone-500 mt-1">
              Selected: {(videoFile.size / (1024 * 1024)).toFixed(1)}MB
            </p>
          )}
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

        {/* Single Quiz Switch — matches spec: optional, one question only */}
        <div className="flex items-center justify-between border border-stone-200 rounded-xl px-3 py-3">
          <div>
            <p className="text-sm font-semibold text-stone-800">💡 Add 1 Quiz to Reel?</p>
            <p className="text-[11px] text-stone-500">Viewers ko reel khatam hone par ek sawaal dikhega (+5 Coins)</p>
          </div>
          <button
            onClick={() => setAddQuiz((v) => !v)}
            className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${
              addQuiz ? 'bg-clay justify-end' : 'bg-stone-300 justify-start'
            }`}
          >
            <span className="w-5 h-5 bg-white rounded-full block" />
          </button>
        </div>

        {addQuiz && (
          <QuizBuilder
            question={q1} setQuestion={setQ1}
            options={q1Options} setOptions={setQ1Options}
            correct={q1Correct} setCorrect={setQ1Correct}
          />
        )}

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

        <div className="border border-violet/30 bg-violet-light rounded-xl p-3">
          <p className="text-sm font-semibold text-violet mb-1">📺 Long-Form Lesson (optional)</p>
          <p className="text-[11px] text-violet/70 mb-2">
            A fuller tutorial, 16:9, that viewers open from a &quot;See Full Lesson&quot; link on your reel.
          </p>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setLongFormFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
          {longFormFile && (
            <p className="text-[11px] text-stone-500 mt-1">
              {(longFormFile.size / (1024 * 1024)).toFixed(1)}MB (up to 200MB)
            </p>
          )}
          {longFormFile && (
            <input
              value={longFormTitle}
              onChange={(e) => setLongFormTitle(e.target.value)}
              placeholder="Long-form title (optional)"
              className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm mt-2"
            />
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {uploading && (
          <div>
            <div className="w-full bg-stone-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-clay h-2.5 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-stone-500 mt-1">{progressLabel} {progress}%</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="w-full bg-clay text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50"
        >
          {uploading ? `Uploading… ${progress}%` : 'Publish Reel'}
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
  question, setQuestion, options, setOptions, correct, setCorrect,
}: {
  question: string
  setQuestion: (v: string) => void
  options: string[]
  setOptions: (v: string[]) => void
  correct: number
  setCorrect: (v: number) => void
}) {
  return (
    <div className="border border-stone-200 rounded-xl p-3">
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
