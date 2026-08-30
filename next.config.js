/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: true,   // ← TEMPORARILY true kar do (PWA poori tarah band)
  cleanupOutdatedCaches: true,
  fallbacks: {
    document: '/offline.html',
  },
})

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
}

module.exports = withPWA(nextConfig)