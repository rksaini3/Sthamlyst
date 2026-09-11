import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css'; // आपकी पुरानी ग्लोबल CSS फ़ाइल

const inter = Inter({ subsets: ['latin'] });

// 📱 PWA और SEO के लिए आवश्यक मेटाडेटा
export const metadata: Metadata = {
  title: 'Sthamly - Generative Engine Optimization (GEO)',
  description: 'जांचें कि क्या ChatGPT और Perplexity आपके ब्रांड को रेकमेंड करते हैं और 1-क्लिक में फिक्स करें।',
  manifest: '/manifest.json', // आपका पुराना PWA मेनिफेस्टो लिंक
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sthamly AI',
  },
};

// 📱 मोबाइल स्क्रीन और PWA व्यूपोर्ट कॉन्फ़िगरेशन
export const viewport: Viewport = {
  themeColor: '#EA580C', // आपकी ऑरेंज ब्रांड थीम
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hi">
      <head>
        {/* PWA के लिए iOS सपोर्ट मैटा टैग्स */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={`${inter.className} bg-gray-50 antialiased`}>
        
        {/* मुख्य एप्लीकेशन व्यू */}
        {children}

        {/* 💳 रेज़रपे चेकआउट स्क्रिप्ट - इसके बिना मोबाइल PWA पेमेंट गेटवे क्रैश हो जाएगा */}
        <Script 
          src="https://razorpay.com" 
          strategy="lazyOnload" 
        />
      </body>
    </html>
  );
}
