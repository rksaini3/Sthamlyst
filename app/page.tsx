'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [domainUrl, setDomainUrl] = useState('')
  const [brandKeyword, setBrandKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleFreeAudit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!domainUrl || !brandKeyword) {
      setErrorMsg('कृपया अपनी वेबसाइट का URL और मुख्य कीवर्ड दोनों भरें।')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      // 🚀 बैकएंड में OpenRouter (ChatGPT + Perplexity Parallel Request) को ट्रिगर करना
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainUrl, brandKeyword })
      })

      const data = await res.json()

      if (data.success) {
        // ऑडिट सफल होने पर यूजर को डैशबोर्ड पर भेजें और डेटा को स्टेट या लोकलस्टोरेज में पास करें
        localStorage.setItem('sthamly_last_audit', JSON.stringify({
          domainUrl,
          brandKeyword,
          perplexity: data.perplexity,
          chatgpt: data.chatgpt
        }))
        router.push('/dashboard')
      } else {
        setErrorMsg(data.error || 'ऑडिट विफल रहा। कृपया पुनः प्रयास करें।')
      }
    } catch (err: any) {
      console.error(err)
      setErrorMsg('सर्वर से कनेक्ट करने में समस्या आ रही है।')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 pb-24 min-h-dvh flex flex-col justify-center bg-gray-50 text-gray-900">
      
      {/* 🚀 प्रीमियम ब्रांड हेडर */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-orange-600 tracking-tight">Sthamly</h1>
        <p className="text-sm font-semibold text-gray-500 mt-2 uppercase tracking-wider">
          Generative Engine Optimization (GEO)
        </p>
        <p className="text-xs text-gray-400 mt-1">
          जांचें कि क्या ChatGPT और Perplexity आपके ब्रांड को रेकमेंड करते हैं
        </p>
      </div>

      {/* 📊 फ्री हुक ऑडिट कार्ड */}
      <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">
          Free AI Search Audit 🔍
        </h2>

        <form onSubmit={handleFreeAudit} className="space-y-4">
          
          {/* इनपुट 1: वेबसाइट URL */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Website URL
            </label>
            <input
              type="text"
              placeholder="e.g. lenskart.com"
              value={domainUrl}
              onChange={(e) => setDomainUrl(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium text-sm text-gray-800"
              disabled={loading}
            />
          </div>

          {/* इनपुट 2: मुख्य कीवर्ड */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Core Business Keyword
            </label>
            <input
              type="text"
              placeholder="e.g. best glasses online"
              value={brandKeyword}
              onChange={(e) => setBrandKeyword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium text-sm text-gray-800"
              disabled={loading}
            />
          </div>

          {/* त्रुटि संदेश */}
          {errorMsg && (
            <p className="text-xs font-semibold text-red-500 text-center bg-red-50 py-2 rounded-xl">
              ⚠️ {errorMsg}
            </p>
          )}

          {/* मुख्य ट्रिगर बटन */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 text-white font-extrabold rounded-2xl transition-all duration-200 shadow-lg ${
              loading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-95 active:scale-95'
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>AI इंजनों को स्कैन किया जा रहा है...</span>
              </div>
            ) : (
              'Check AI Search Visibility'
            )}
          </button>
          
        </form>
      </div>

      {/* 🔒 ट्रस्ट बैज */}
      <p className="text-[11px] text-center text-gray-400 mt-6 font-medium">
        Powered by OpenRouter API & Stripe Framework. 100% Safe & Secure.
      </p>
      
    </div>
  )
}
