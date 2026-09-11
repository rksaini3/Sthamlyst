'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Dashboard() {
  const [auditData, setAuditData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fixApplied, setFixApplied] = useState(false);
  const [schemaCode, setSchemaCode] = useState('');

  useEffect(() => {
    // होमपेज द्वारा स्टोर किए गए डेटा को localStorage से निकालना
    const savedData = localStorage.getItem('sthamly_last_audit');
    if (savedData) {
      setAuditData(JSON.parse(savedData));
    }
  }, []);

  const handleOneClickFix = async () => {
    if (!auditData) return;
    setLoading(true);

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainUrl: auditData.domainUrl,
          brandKeyword: auditData.brandKeyword,
          action: 'APPLY_FIX'
        })
      });
      const data = await res.json();
      if (data.success) {
        setFixApplied(true);
        setSchemaCode(data.schemaPayload);
      }
    } catch (err) {
      alert('फिक्स अप्लाई करने में कोई एरर आया।');
    }
    setLoading(false);
  };

  if (!auditData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 text-black text-sm">
        <p>कोई पिछला ऑडिट डेटा नहीं मिला।</p>
        <Link href="/" className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-xl font-bold">
          🏠 होमपेज पर जाएं
        </Link>
      </div>
    );
  }

  // दोनों एआई इंजनों के मेंशन्स के आधार पर ओवरऑल स्कोर निकालना
  const chatgptScore = auditData.chatgpt?.score || 40;
  const perplexityScore = auditData.perplexity?.score || 40;
  const totalScore = Math.round((chatgptScore + perplexityScore) / 2);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 px-4 py-8 max-w-md mx-auto font-sans">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <div>
          <h1 className="text-xl font-black text-orange-600">Sthamly Dashboard</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{auditData.domainUrl}</p>
        </div>
        <Link href="/dashboard/wp-connect" className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-xl font-bold text-gray-700 shadow-sm">
          🔌 Connect WP
        </Link>
      </div>

      {/* स्कोर मीटर पैनल */}
      <div className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-xs font-extrabold text-gray-500 uppercase">AI Visibility Index:</span>
          <span className={`text-3xl font-black ${totalScore > 70 ? 'text-green-600' : 'text-amber-500'}`}>
            {totalScore}/100
          </span>
        </div>

        {/* एआई इंजन ब्रेकडाउन ब्रेकडाउन */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase">ChatGPT status</p>
            <p className={`text-xs font-black mt-1 ${auditData.chatgpt?.mentioned ? 'text-green-600' : 'text-rose-500'}`}>
              {auditData.chatgpt?.mentioned ? '✓ Recommended' : '✗ Missing Citation'}
            </p>
          </div>
          <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Perplexity status</p>
            <p className={`text-xs font-black mt-1 ${auditData.perplexity?.mentioned ? 'text-green-600' : 'text-rose-500'}`}>
              {auditData.perplexity?.mentioned ? '✓ Recommendation ok' : '✗ Citations Missing'}
            </p>
          </div>
        </div>

        {/* लाइव रिपोर्ट समरी */}
        <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-600 border border-gray-100">
          <p className="font-bold text-gray-800 mb-1">🤖 AI Crawl Summary Analysis:</p>
          <p className="italic text-gray-500">"{auditData.chatgpt?.details || 'No extended log details available.'}"</p>
        </div>

        {/* 1-क्लिक फिक्स एक्शन */}
        {!fixApplied ? (
          <button 
            onClick={handleOneClickFix} 
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-sm rounded-2xl shadow-md active:scale-95 transition"
          >
            {loading ? 'Injecting GEO Optimizations...' : '✨ 1-Click AI Search Fix Now'}
          </button>
        ) : (
          <div className="p-4 bg-green-50 border border-green-200 rounded-2xl space-y-2">
            <p className="text-xs text-green-700 font-bold">✅ Sthamly Smart Fix Successfully Pushed to WordPress Site!</p>
            <pre className="text-[9px] bg-gray-900 text-green-400 p-2.5 rounded-xl overflow-x-auto max-h-32">
              {schemaCode}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
