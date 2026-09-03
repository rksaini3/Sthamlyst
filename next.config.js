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
  // ← ADDED: next-pwa regenerates public/sw.js on every build, which
  // would wipe out any push-notification code pasted directly into that
  // file. importScripts tells the generated service worker to pull in
  // this extra file at the top, so your push handlers survive rebuilds.
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
