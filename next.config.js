const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: false,   // ← manual control sirf component ke haath mein
  clientsClaim: false,  // ← duplicate/race controllerchange events band
  disable: process.env.NODE_ENV === 'development',
  cleanupOutdatedCaches: true,
  fallbacks: { document: '/offline.html' },
  importScripts: ['sw-push-addition.js'],
  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages-cache',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 60 * 60, // ← 1 din se ghata kar 1 ghanta kiya,
          // taaki deploy ke baad purana HTML zyada der tak serve na ho
        },
      },
    },
    {
      urlPattern: /\.(?:js|css)$/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'static-resources' },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'images',
        expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: ({ url }) => url.origin === self.location.origin,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'others',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
  ],
})