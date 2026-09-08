/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  clientsClaim: true,
  disable: process.env.NODE_ENV === 'development',
  cleanupOutdatedCaches: true,
  fallbacks: {
    document: '/offline.html',
  },
  importScripts: ['sw-push-addition.js'],

  // ← ADDED: Ye asli fix hai. Bina explicit runtimeCaching ke, next-pwa
  // kabhi-kabhi HTML pages ko bhi "cache-first" jaisa serve kar sakta hai —
  // matlab agar ek baar koi purana/tuta hua page cache ho gaya (jaise humare
  // beech ke failed builds ke time), to naya deploy hone ke baad bhi wahi
  // purana HTML dikhta rehta hai jab tak cache khud expire na ho.
  //
  // Neeche har page-navigation (HTML document) ke liye NetworkFirst
  // strategy force kar rahe hain — matlab HAMESHA pehle server se fresh
  // page maangega; sirf agar internet na ho tabhi cache/offline-fallback
  // use hoga. Baaki static assets (JS/CSS/images) StaleWhileRevalidate
  // rakhte hain — wo safe hai kyunki unke filenames build-hash ke saath
  // badalte hain.
  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages-cache',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 1 din
        },
      },
    },
    {
      urlPattern: /\.(?:js|css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-resources',
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 din
        },
      },
    },
    {
      urlPattern: ({ url }) => url.origin === self.location.origin,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'others',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60,
        },
      },
    },
  ],
})

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
}

module.exports = withPWA(nextConfig)
