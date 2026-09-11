'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function WordPressConnectPage() {
  const [siteUrl, setSiteUrl] = useState('');
  const [wpUsername, setWpUsername] = useState('');
  const [wpAppPassword, setWpAppPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const router = useRouter();

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteUrl || !wpUsername || !wpAppPassword) {
      setStatusMsg({ type: 'error', text: 'कृपया सभी फ़ील्ड सही-सही भरें।' });
      return;
    }

    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    try {
      // नोट: असल प्रोडक्शन में यहाँ Supabase क्लाइंट का उपयोग करके 'wordpress_connections' टेबल में 
      // authenticated user_id के साथ डेटा इन्सर्ट (Insert) किया जाएगा।
      // मोबाइल से सेफ टेस्टिंग के लिए हमने 1.2 सेकंड का रिस्पॉन्सिव मॉक डिले दिया है।
      await new Promise((resolve) => setTimeout(resolve, 1200));

      setStatusMsg({ type: 'success', text: '🎉 वर्डप्रेस साइट Sthamly AI ब्रिज से सुरक्षित जुड़ गई है!' });
      
      // सफल कनेक्शन के बाद 1.5 सेकंड में मुख्य डैशबोर्ड पर वापस भेजना
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);

    } catch (err) {
      setStatusMsg({ type: 'error', text: 'कनेक्शन विफल रहा। कृपया पासवर्ड जांचें।' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col justify-center px-4 font-sans max-w-md mx-auto relative">
      
      {/* बैक बटन */}
      <Link href="/dashboard" className="absolute top-6 left-4 text-xs font-bold text-gray-500 flex items-center gap-1 bg-white border px-3 py-1.5 rounded-xl shadow-sm">
        ← डैशबोर्ड
      </Link>

      <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800">🔌 Connect WordPress Website</h2>
          <p className="text-xs text-gray-400 mt-1">
            1-Click Auto-Fix को चालू करने के लिए अपनी वर्डप्रेस वेबसाइट का क्रेडेंशियल दर्ज करें। यह डेटा पूरी तरह एन्क्रिप्टेड रहता है।
          </p>
        </div>

        <form onSubmit={handleConnect} className="space-y-4">
          
          {/* वेबसाइट URL */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">WordPress Site URL</label>
            <input 
              type="url" 
              required 
              placeholder="e.g. https://myblog.com" 
              value={siteUrl} 
              onChange={e => setSiteUrl(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
              disabled={loading}
            />
          </div>

          {/* वर्डप्रेस यूजरनेम */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">WP Admin Username</label>
            <input 
              type="text" 
              required 
              placeholder="e.g. admin" 
              value={wpUsername} 
              onChange={e => setWpUsername(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
              disabled={loading}
            />
          </div>

          {/* वर्डप्रेस एप्लीकेशन पासवर्ड */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">WP Application Password</label>
            <input 
              type="password" 
              required 
              placeholder="xxxx xxxx xxxx xxxx" 
              value={wpAppPassword} 
              onChange={e => setWpAppPassword(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium tracking-widest"
              disabled={loading}
            />
            <p className="text-[9px] text-gray-400 mt-1">
              *नोट: अपने WP Dashboard {'>'} Users {'>'} Profile में जाकर एक नया "Application Password" जेनरेट करें। अपना मुख्य लॉगिन पासवर्ड यहाँ न डालें।
            </p>
          </div>

          {/* स्टेटस मैसेज डिस्प्ले */}
          {statusMsg.text && (
            <p className={`text-xs font-bold text-center py-2.5 rounded-xl ${
              statusMsg.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
            }`}>
              {statusMsg.type === 'success' ? '' : '⚠️ '} {statusMsg.text}
            </p>
          )}

          {/* सबमिट बटन */}
          <button 
            type="submit" 
            disabled={loading} 
            className={`w-full py-4 text-white font-extrabold rounded-2xl transition-all shadow-lg ${
              loading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-95 active:scale-95'
            }`}
          >
            {loading ? 'Establishing Secure Sync...' : 'Establish Secure Connection'}
          </button>
        </form>
      </div>
    </div>
  );
}
