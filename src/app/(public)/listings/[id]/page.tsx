// src/app/(public)/listings/[id]/page.tsx
// Public listing detail — UUID path; redirects to /{slug} when a public slug exists.
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import {
  listingIsPubliclyAvailable,
  loadPublishedListingById,
  loadPropertyForListingId,
  loadPropertyFromListing,
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
import { getOrgBySlug } from '@/lib/orgs'
import { headers } from 'next/headers'

/** Signed cover URLs expire (~1h) — must not reuse a cached RSC/fetch payload. */
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ org?: string }>
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id } = await params
  const { org: orgSlugParam } = await searchParams
  const org = await resolvePublicRequestOrg(orgSlugParam)
  if (!org) return fallbackPublicShareMetadata()
  const subject = await resolvePublicShareSubject({ orgId: org.id, listingId: id })
  return buildPublicShareMetadata(subject)
}

export default async function ListingDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { org: orgSlugParam } = await searchParams

  const headersList = await headers()
  const orgSlug =
    headersList.get('x-org-slug') ||
    orgSlugParam ||
    process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ||
    'canary'
  const org = await getOrgBySlug(orgSlug)
  if (!org) notFound()

  const orgQuery = orgSlugParam ? `?org=${orgSlugParam}` : ''

  if (!isListingUuid(id)) {
    permanentRedirect(`/${id}${orgQuery}`)
  }

  const listing = await loadPublishedListingById(org.id, id)
  if (listing && listingIsPubliclyAvailable(listing)) {
    if (listing.slug) {
      permanentRedirect(`/${listing.slug}${orgQuery}`)
    }
    return renderPublishedListingPage({ listing, orgSlug })
  }

  const property = listing
    ? await loadPropertyFromListing(org.id, listing)
    : await loadPropertyForListingId(org.id, id)
  if (!property) notFound()

  if (property.slug) {
    permanentRedirect(`/${property.slug}${orgQuery}`)
  }

  return renderPropertyPublicPage({ property, orgSlug, orgId: org.id })
}
