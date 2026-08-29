/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Forces every client (including tabs that already have an old
  // service worker registered from before) to take control of the
  // new service worker immediately instead of waiting for all tabs
  // to close first — this is what was leaving old chunk references
  // stuck on machines that had tested the app before this fix.
  clientsClaim: true,
  // Prevents the service worker from precaching Next.js's internal
  // build-manifest files. Without this, after every new deploy the
  // service worker keeps serving JS chunk references from the OLD
  // build — those chunks no longer exist on the server, so the page
  // loads with a blank/broken UI until the user manually refreshes.
  buildExcludes: [/app-build-manifest\.json$/, /middleware-manifest\.json$/],
})

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
}

module.exports = withPWA(nextConfig)
