'use client';
import { useState } from 'react';

export default function AiDashboardClient() {
  const [url, setUrl] = useState('');
  const [brand, setBrand] = useState('');
  const [loading, setLoading] = useState(false);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [aiReport, setAiReport] = useState('');
  const [fixApplied, setFixApplied] = useState(false);
  const [schemaCode, setSchemaCode] = useState('');

  const handleScan = async () => {
    if (!url || !brand) return alert('कृपया सभी जानकारी भरें!');
    setLoading(true);
    setScore(null);
    setFixApplied(false);

    const res = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ websiteUrl: url, brandName: brand, action: 'RUN_AUDIT' })
    });
    const data = await res.json();
    if (data.success) {
      setScore(data.score);
      setAuditId(data.auditId);
      setAiReport(data.analysis);
    }
    setLoading(false);
  };

  const handlePaymentAndFix = async () => {
    if (!auditId) return;
    setLoading(true);

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'INITIATE_FIX_PAYMENT', auditId })
      });
      const orderData = await res.json();

      if (!orderData.success) throw new Error('Payment initialization failed');

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: 'INR',
        name: 'Sthamly AI SaaS',
        description: '1-Click WordPress AI Optimization Fix',
        order_id: orderData.orderId,
        handler: async function (response: any) {
          const verifyRes = await fetch('/api/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ websiteUrl: url, brandName: brand, action: 'VERIFY_AND_FIX', auditId })
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            setFixApplied(true);
            setSchemaCode(verifyData.schemaPayload);
            alert('🎉 भुगतान सफल! Sthamly AI कोड लाइव सिंक हो गया है।');
          }
        },
        theme: { color: '#EA580C' }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      alert('भुगतान प्रक्रिया में एरर आया।');
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-950 text-white p-4 min-h-screen">
      <div className="mb-6">
        <h1 className="text-xl font-black text-orange-500">🤖 Sthamly AI Engine</h1>
        <p className="text-[11px] text-slate-400">Google AI Overviews और LLM सर्च विजिबिलिटी</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
        <input type="text" placeholder="Brand Name (e.g. Sthamly)" value={brand} onChange={e => setBrand(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none" />
        <input type="url" placeholder="Website URL (https://example.com)" value={url} onChange={e => setUrl(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none" />
        <button onClick={handleScan} disabled={loading} className="w-full py-2.5 bg-orange-600 text-xs font-bold rounded-xl transition">
          {loading ? 'Entity Analyzing...' : '🔍 Check AI Visibility Score'}
        </button>
      </div>

      {score !== null && (
        <div className="mt-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">AI Discoverability Score:</span>
            <span className="text-2xl font-black text-amber-500">{score}/100</span>
          </div>

          {!fixApplied ? (
            <button onClick={handlePaymentAndFix} disabled={loading} className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 font-black text-xs rounded-xl shadow-lg">
              {loading ? 'Processing Transaction...' : '✨ Pay ₹499 & 1-Click Fix Now'}
            </button>
          ) : (
            <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-xl space-y-2">
              <p className="text-[11px] text-emerald-400 font-bold">✅ WordPress AI Injection Live!</p>
              <pre className="text-[9px] bg-slate-950 text-green-400 p-2 rounded-md overflow-x-auto max-h-24">{schemaCode}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
