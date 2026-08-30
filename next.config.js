/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  cleanupOutdatedCaches: true,
  fallbacks: {
    document: '/offline.html',
  },
  runtimeCaching: [
    {
      urlPattern: ({ url }) => url.hostname.includes('supabase.co'),
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages-cache',
        networkTimeoutSeconds: 3,
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