/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Prevents the service worker from precaching Next.js's internal
  // build-manifest files. Without this, after every new deploy the
  // service worker keeps serving JS chunk references from the OLD
  // build — those chunks no longer exist on the server, so the page
  // loads with a blank/broken UI until the user manually refreshes
  // and the service worker catches up.
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
