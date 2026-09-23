import type { MetadataRoute } from 'next'

const BASE_URL = 'https://www.sthamly.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Ye auth-gated app pages hain — bina login/params ke khaali ya redirect
      // dete hain. Inhe disallow karne se Google apna crawl budget in par
      // waste nahi karega, aur "Page with redirect" / 404 errors kam honge.
      disallow: ['/login', '/dashboard', '/optimizer', '/profile', '/api/'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
