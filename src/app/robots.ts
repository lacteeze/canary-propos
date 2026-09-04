import type { MetadataRoute } from 'next'
import { publicShareOrigin } from '@/lib/listings/public-share-metadata'

export default function robots(): MetadataRoute.Robots {
  const origin = publicShareOrigin()
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/app', '/api', '/onboard', '/dashboard', '/admin', '/settings', '/inquiries'],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin.replace(/^https?:\/\//, ''),
  }
}
