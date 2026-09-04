'use client'

import { useRef, useState } from 'react'
import { X, Mic, Square, Check, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'

const PLEDGE_SCRIPT =
  'मैं वादा करता/करती हूं कि मैं Sthamly पर सही सामान, सही दाम और ईमानदारी से बेचूंगा/बेचूंगी।'

type Props = {
  onClose: () => void
  onSaved: () => void
}

export default function VoicePledgeSheet({ onClose, onSaved }: Props) {
  const { user } = useAuth()
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((track) => track.stop())
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch (err) {
      setError('Microphone access nahi mil paaya. Settings mein permission check karein.')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  function reRecord() {
    setAudioBlob(null)
    setAudioUrl(null)
  }

  async function handleSubmit() {
    if (!audioBlob || !user) return
    setUploading(true)
    setError('')

    try {
      const fileName = `${user.id}/${Date.now()}-pledge.webm`
      const { error: uploadError } = await supabase.storage
        .from('comment-audio')
        .upload(fileName, audioBlob, { contentType: 'audio/webm' })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage.from('comment-audio').getPublicUrl(fileName)

      const { error: insertError } = await supabase.from('voice_pledges').upsert({
        seller_id: user.id,
        audio_url: publicUrlData.publicUrl,
      })

      if (insertError) throw insertError

      onSaved()
    } catch (err: any) {
      setError('Save nahi ho paya: ' + (err?.message || 'kuch galat ho gaya'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-t-3xl p-5 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
            🎙️ Safety Pledge Record Karein
          </h2>
          <button onClick={onClose} aria-label="Band karein">
            <X size={20} className="text-stone-400" />
          </button>
        </div>

        <p className="text-sm text-stone-600 dark:text-stone-300 mb-4">
          Apni aawaz mein ye line bolkar record karein — ye aapki profile par rahegi taaki
          buyers ko bharosa ho:
        </p>

        <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3 mb-5">
          <p className="text-sm font-medium text-stone-800 dark:text-stone-100">{PLEDGE_SCRIPT}</p>
        </div>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <div className="flex flex-col items-center gap-4">
          {!audioUrl ? (
            <button
              onClick={recording ? stopRecording : startRecording}
              className={`w-16 h-16 rounded-full flex items-center justify-center text-white ${
                recording ? 'bg-red-500' : 'bg-mehendi'
              }`}
              aria-label={recording ? 'Recording rokiye' : 'Recording shuru karein'}
            >
              {recording ? <Square size={22} /> : <Mic size={26} />}
            </button>
          ) : (
            <audio src={audioUrl} controls className="w-full" />
          )}

          {recording && <p className="text-xs text-red-500 animate-pulse">रिकॉर्ड हो रहा है…</p>}

          {audioUrl && !uploading && (
            <div className="flex gap-3 w-full">
              <button
                onClick={reRecord}
                className="flex-1 flex items-center justify-center gap-1.5 border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 font-semibold py-2.5 rounded-xl text-sm"
              >
                <RotateCcw size={15} /> दोबारा
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 flex items-center justify-center gap-1.5 bg-mehendi text-white font-semibold py-2.5 rounded-xl text-sm"
              >
                <Check size={15} /> Save Karein
              </button>
            </div>
          )}

          {uploading && <p className="text-xs text-stone-400">Save ho raha hai…</p>}
        </div>
      </div>
    </div>
  )
}
