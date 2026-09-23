import type { MetadataRoute } from 'next'

const BASE_URL = 'https://www.sthamly.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return [
    {
      url: BASE_URL,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/ai-faq`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}

// Note: /login, /dashboard, /optimizer, /profile jaan-boojh kar hataye gaye hain.
// Ye sab auth-gated app pages hain (login ya query params ke bina khaali/redirect
// dete hain) — public sitemap mein inka hona Google ko "Page with redirect" aur
// "Not found (404)" errors deta hai. In pages ko /app/robots.ts mein bhi disallow
// kar diya gaya hai taaki Google inhe crawl hi na kare.
