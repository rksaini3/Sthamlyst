import type { MetadataRoute } from 'next'

// Change this if you deploy on a subdomain (e.g. learn.sthamly.com)
const BASE_URL = 'https://sthamly.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return [
    {
      url: BASE_URL,
      lastModified,
      changeFrequency: 'monthly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/bazaar`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/learn`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ]
}
