// src/app/(public)/[slug]/page.tsx
// Root-level SEO address slug for published listings (e.g. /151-a-signal-hill-road).
import { notFound, permanentRedirect } from 'next/navigation'
import { preload } from 'react-dom'
import {
  LISTING_DETAIL_SELECT,
  ListingDetailView,
  type ListingDetailListing,
} from '@/components/listings/ListingDetailView'
import { getLandingCopy } from '@/lib/landing/content'
import { getPublishedListings } from '@/lib/landing/get-published-listings'
import { getDetailPageCarouselGroups } from '@/lib/listings/browse-utils'
import { isListingUuid } from '@/lib/listings/listing-href'
import { isReservedListingSlug } from '@/lib/listings/reserved-slugs'
import { createPublicClient } from '@/lib/supabase/public'
import { getOrgBySlug } from '@/lib/orgs'
import { headers } from 'next/headers'
import { getListingPhotoPathsForProperty } from '@/lib/storage/property-listing-media'
import { resolveListingGalleryPhotos } from '@/lib/storage/listing-photos'

/** Signed cover URLs expire (~1h) — must not reuse a cached RSC/fetch payload. */
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ org?: string }>
}

export default async function ListingSlugPage({ params, searchParams }: PageProps) {
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

  const supabase = createPublicClient()
  const { data } = await supabase
    .from('listings')
    .select(LISTING_DETAIL_SELECT)
    .eq('slug', slug)
    .eq('org_id', org.id)
    .eq('status', 'published')
    .single()

  const listing = data as ListingDetailListing | null
  if (!listing) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unit = listing.units as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const property = unit?.properties as any
  const listingCity = property?.city ?? "St. John's"

  const galleryPromise = (async () => {
    const fromMedia = property?.id ? await getListingPhotoPathsForProperty(property.id) : []
    const photoPaths: string[] = (
      fromMedia.length > 0 ? fromMedia : (property?.photo_paths ?? [])
    ).filter((p: string) => !!p && !/^https?:\/\//i.test(p))
    return resolveListingGalleryPhotos(photoPaths)
  })()
  const [{ all: listingPhotos }, allPublished] = await Promise.all([
    galleryPromise,
    getPublishedListings(orgSlug),
  ])

  if (listingPhotos[0]) {
    preload(listingPhotos[0], { as: 'image', fetchPriority: 'high' })
  }

  const carouselGroups = getDetailPageCarouselGroups(allPublished, listing.id, listingCity)
  const cardCopy = getLandingCopy('en')
  const listingCardCopy = {
    tBed: cardCopy.tBed,
    tBath: cardCopy.tBath,
    tPark: cardCopy.tPark,
    longTerm: cardCopy.longTerm,
    midTerm: cardCopy.midTerm,
  }

  return (
    <ListingDetailView
      listing={listing}
      listingPhotos={listingPhotos}
      carouselGroups={carouselGroups}
      orgSlug={orgSlug}
      listingCardCopy={listingCardCopy}
    />
  )
}
