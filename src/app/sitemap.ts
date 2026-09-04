import type { MetadataRoute } from 'next'
import { getPublishedListingPaths } from '@/lib/landing/get-published-listing-paths'
import { allListingGroupPaths } from '@/lib/listing-groups/registry'
import { rentalsHref } from '@/lib/listing-groups/types'
import { publicShareOrigin } from '@/lib/listings/public-share-metadata'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = publicShareOrigin()
  const listingPaths = await getPublishedListingPaths()
  const now = new Date()

  const staticPaths = ['/', '/rent', '/privacy']
  const rentalPaths = allListingGroupPaths().map((path) => rentalsHref(path))

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${origin}${path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'daily' : 'monthly',
    priority: path === '/' ? 1 : 0.4,
  }))
  const rentalEntries: MetadataRoute.Sitemap = rentalPaths.map((path) => ({
    url: `${origin}${path}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: path === '/rentals' ? 0.9 : 0.8,
  }))
  const listingEntries: MetadataRoute.Sitemap = listingPaths.map((path) => ({
    url: `${origin}${path}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  return [...staticEntries, ...rentalEntries, ...listingEntries]
}
