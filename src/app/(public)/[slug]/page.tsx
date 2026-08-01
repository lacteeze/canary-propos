// src/app/(public)/[slug]/page.tsx
// Root-level SEO slug: published listing first, else public property page (incl. leased).
import { notFound, permanentRedirect } from 'next/navigation'
import {
  loadPublishedListingBySlug,
  loadPublishedListingForProperty,
  loadPropertyBySlug,
  renderPublishedListingPage,
  renderPropertyPublicPage,
} from '@/lib/listings/public-slug-page'
import { isListingUuid } from '@/lib/listings/listing-href'
import { isReservedListingSlug } from '@/lib/listings/reserved-slugs'
import { getOrgBySlug } from '@/lib/orgs'
import { headers } from 'next/headers'

/** Signed cover URLs expire (~1h) — must not reuse a cached RSC/fetch payload. */
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ org?: string }>
}

export default async function PublicSlugPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const { org: orgSlugParam } = await searchParams

  if (isReservedListingSlug(slug)) notFound()

  const headersList = await headers()
  const orgSlug =
    headersList.get('x-org-slug') ||
    orgSlugParam ||
    process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ||
    'canary'
  const org = await getOrgBySlug(orgSlug)
  if (!org) notFound()

  const orgQuery = orgSlugParam ? `?org=${orgSlugParam}` : ''

  if (isListingUuid(slug)) {
    permanentRedirect(`/listings/${slug}${orgQuery}`)
  }

  // 1) Published listing with this slug
  const listingBySlug = await loadPublishedListingBySlug(org.id, slug)
  if (listingBySlug) {
    return renderPublishedListingPage({ listing: listingBySlug, orgSlug })
  }

  // 2) Property with this slug
  const property = await loadPropertyBySlug(org.id, slug)
  if (!property) notFound()

  // Prefer full listing detail when any unit on the property is published
  const publishedOnProperty = await loadPublishedListingForProperty(org.id, property.id)
  if (publishedOnProperty) {
    return renderPublishedListingPage({ listing: publishedOnProperty, orgSlug })
  }

  return renderPropertyPublicPage({ property, orgSlug, orgId: org.id })
}
