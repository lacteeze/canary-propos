// Share / Open Graph metadata for public listing and property URLs.
// Crawlers otherwise inherit the staff-app title ("Canary PropOS") and scrape a
// random page image (often a similar-listing card).

import type { Metadata } from 'next'
import { headers } from 'next/headers'
import type { ListingDetailListing } from '@/components/listings/ListingDetailView'
import type { PropertyPublicProperty } from '@/components/listings/PropertyPublicView'
import { shortAddress } from '@/lib/canary/entity-href'
import { isListingUuid, listingPublicHref } from '@/lib/listings/listing-href'
import {
  listingIsPubliclyAvailable,
  loadPublishedListingById,
  loadPublishedListingBySlug,
  loadPublishedListingForProperty,
  loadPropertyForListingId,
  loadPropertyForPublicSlug,
  loadPropertyFromListing,
} from '@/lib/listings/public-slug-page'
import { isReservedListingSlug } from '@/lib/listings/reserved-slugs'
import { getOrgBySlug } from '@/lib/orgs'

export const PUBLIC_SHARE_SITE_NAME = 'Canary PM'

export type PublicShareSubject = {
  title: string
  description: string
  propertyId: string | null
  canonicalPath: string
}

export function publicShareOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://canarypm.ca').replace(/\/$/, '')
}

export function publicShareTitle(
  streetAddress: string | null | undefined,
  fallbackTitle?: string | null,
): string {
  const fromStreet = shortAddress(streetAddress)
  if (fromStreet) return fromStreet
  const fromFallback = shortAddress(fallbackTitle)
  if (fromFallback) return fromFallback
  return PUBLIC_SHARE_SITE_NAME
}

export function publicShareDescription(opts: {
  city?: string | null
  listingDescription?: string | null
}): string {
  const excerpt = excerptText(opts.listingDescription)
  if (excerpt) return excerpt
  const city = (opts.city ?? '').trim() || "St. John's"
  return `Rental in ${city} — ${PUBLIC_SHARE_SITE_NAME}`
}

export function publicShareOgImagePath(propertyId: string): string {
  return `/api/og/property/${propertyId}`
}

export function fallbackPublicShareMetadata(): Metadata {
  const origin = publicShareOrigin()
  return shareMetadata({
    title: PUBLIC_SHARE_SITE_NAME,
    description: `Homes for rent in St. John's — ${PUBLIC_SHARE_SITE_NAME}`,
    imageUrl: `${origin}/api/org-icon`,
    canonicalPath: '/',
  })
}

export function buildPublicShareMetadata(subject: PublicShareSubject | null): Metadata {
  if (!subject) return fallbackPublicShareMetadata()
  const origin = publicShareOrigin()
  const imageUrl = subject.propertyId
    ? `${origin}${publicShareOgImagePath(subject.propertyId)}`
    : `${origin}/api/org-icon`
  return shareMetadata({
    title: subject.title,
    description: subject.description,
    imageUrl,
    canonicalPath: subject.canonicalPath,
  })
}

export async function resolvePublicRequestOrg(
  orgSlugParam?: string,
): Promise<{ id: string; slug: string } | null> {
  const headersList = await headers()
  const orgSlug =
    headersList.get('x-org-slug') ||
    orgSlugParam ||
    process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ||
    'canary'
  const org = await getOrgBySlug(orgSlug)
  if (!org) return null
  return { id: org.id, slug: orgSlug }
}

export async function resolvePublicShareSubject(opts: {
  orgId: string
  slug?: string
  listingId?: string
}): Promise<PublicShareSubject | null> {
  if (opts.listingId) {
    return resolveFromListingId(opts.orgId, opts.listingId)
  }

  const slug = opts.slug?.trim()
  if (!slug || isReservedListingSlug(slug)) return null
  if (isListingUuid(slug)) {
    return resolveFromListingId(opts.orgId, slug)
  }

  const listingBySlug = await loadPublishedListingBySlug(opts.orgId, slug)
  if (listingBySlug && listingIsPubliclyAvailable(listingBySlug)) {
    return subjectFromListing(listingBySlug)
  }

  const property = await loadPropertyForPublicSlug(opts.orgId, slug)
  if (!property) return null

  const publishedOnProperty = await loadPublishedListingForProperty(opts.orgId, property.id)
  if (publishedOnProperty && listingIsPubliclyAvailable(publishedOnProperty)) {
    return subjectFromListing(publishedOnProperty, property)
  }

  return subjectFromProperty(property)
}

function excerptText(text: string | null | undefined, max = 160): string | null {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return null
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1).trimEnd()}…`
}

function listingProperty(listing: ListingDetailListing) {
  return listing.units?.properties ?? null
}

function subjectFromListing(
  listing: ListingDetailListing,
  propertyHint?: PropertyPublicProperty,
): PublicShareSubject {
  const property = propertyHint ?? listingProperty(listing)
  return {
    title: publicShareTitle(property?.street_address, listing.listing_title),
    description: publicShareDescription({
      city: property?.city,
      listingDescription: listing.listing_description,
    }),
    propertyId: property?.id ?? null,
    canonicalPath: listingPublicHref(listing, ''),
  }
}

function subjectFromProperty(property: PropertyPublicProperty): PublicShareSubject {
  return {
    title: publicShareTitle(property.street_address),
    description: publicShareDescription({ city: property.city }),
    propertyId: property.id,
    canonicalPath: property.slug ? `/${property.slug}` : '/',
  }
}

async function resolveFromListingId(
  orgId: string,
  listingId: string,
): Promise<PublicShareSubject | null> {
  const listing = await loadPublishedListingById(orgId, listingId)
  if (listing && listingIsPubliclyAvailable(listing)) {
    return subjectFromListing(listing)
  }
  const property = listing
    ? await loadPropertyFromListing(orgId, listing)
    : await loadPropertyForListingId(orgId, listingId)
  if (!property) return null
  return subjectFromProperty(property)
}

function shareMetadata(opts: {
  title: string
  description: string
  imageUrl: string
  canonicalPath: string
}): Metadata {
  const origin = publicShareOrigin()
  const canonical = `${origin}${opts.canonicalPath.startsWith('/') ? opts.canonicalPath : `/${opts.canonicalPath}`}`
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical },
    openGraph: {
      title: opts.title,
      description: opts.description,
      siteName: PUBLIC_SHARE_SITE_NAME,
      type: 'website',
      url: canonical,
      images: [{ url: opts.imageUrl, alt: opts.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: opts.title,
      description: opts.description,
      images: [opts.imageUrl],
    },
  }
}
