/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  clientsClaim: true, // ← ADDED: naya service-worker turant khule-hue tabs ka control le leta hai,
                       // warna users ko purana cached shell dikhta rehta hai jab tak tab band-khol na ho
  disable: process.env.NODE_ENV === 'development',
  cleanupOutdatedCaches: true,
  fallbacks: {
    document: '/offline.html',
  },
  importScripts: ['sw-push-addition.js'],
})

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
}

module.exports = withPWA(nextConfig)
