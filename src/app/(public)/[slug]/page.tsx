// src/app/(public)/[slug]/page.tsx
// Root-level SEO slug: published listing first, else public property page (incl. leased).
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import {
  listingIsPubliclyAvailable,
  loadPublishedListingBySlug,
  loadPublishedListingForProperty,
  loadPropertyForPublicSlug,
  renderPublishedListingPage,
  renderPropertyPublicPage,
} from '@/lib/listings/public-slug-page'
import {
  buildPublicShareMetadata,
  fallbackPublicShareMetadata,
  resolvePublicRequestOrg,
  resolvePublicShareSubject,
} from '@/lib/listings/public-share-metadata'
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

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const { org: orgSlugParam } = await searchParams
  const org = await resolvePublicRequestOrg(orgSlugParam)
  if (!org) return fallbackPublicShareMetadata()
  const subject = await resolvePublicShareSubject({ orgId: org.id, slug })
  return buildPublicShareMetadata(subject)
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

  // 1) Published listing with this slug — listed even if a current lease exists
  const listingBySlug = await loadPublishedListingBySlug(org.id, slug)
  if (listingBySlug && listingIsPubliclyAvailable(listingBySlug)) {
    if (listingBySlug.slug && listingBySlug.slug !== slug) {
      permanentRedirect(`/${listingBySlug.slug}${orgQuery}`)
    }
    return renderPublishedListingPage({ listing: listingBySlug, orgSlug })
  }

  // 2) Property with this slug, or an unpublished listing slug that maps to a property
  const property = await loadPropertyForPublicSlug(org.id, slug)
  if (!property) notFound()

  if (property.slug && property.slug !== slug) {
    permanentRedirect(`/${property.slug}${orgQuery}`)
  }

  // Prefer full listing detail when a published listing exists on this property
  const publishedOnProperty = await loadPublishedListingForProperty(org.id, property.id)
  if (publishedOnProperty && listingIsPubliclyAvailable(publishedOnProperty)) {
    return renderPublishedListingPage({ listing: publishedOnProperty, orgSlug })
  }

  return renderPropertyPublicPage({ property, orgSlug, orgId: org.id })
}
