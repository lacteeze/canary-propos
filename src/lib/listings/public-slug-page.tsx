import { preload } from 'react-dom'
import {
  LISTING_DETAIL_SELECT,
  ListingDetailView,
  type ListingDetailListing,
} from '@/components/listings/ListingDetailView'
import {
  PropertyPublicView,
  formatPropertyAvailabilityLabel,
  type PropertyPublicProperty,
  type PropertyPublicUnit,
} from '@/components/listings/PropertyPublicView'
import { getLandingCopy } from '@/lib/landing/content'
import { getPublishedListings } from '@/lib/landing/get-published-listings'
import { getDetailPageCarouselGroups } from '@/lib/listings/browse-utils'
import { createPublicClient } from '@/lib/supabase/public'
import { getListingPhotoPathsForProperty } from '@/lib/storage/property-listing-media'
import { resolveListingGalleryPhotos } from '@/lib/storage/listing-photos'

const PROPERTY_PUBLIC_SELECT = `
  id,
  slug,
  street_address,
  city,
  province,
  photo_paths,
  property_type
`

function listingCardCopyFromLanding() {
  const cardCopy = getLandingCopy('en')
  return {
    tBed: cardCopy.tBed,
    tBath: cardCopy.tBath,
    tPark: cardCopy.tPark,
    longTerm: cardCopy.longTerm,
    midTerm: cardCopy.midTerm,
  }
}

export async function renderPublishedListingPage(opts: {
  listing: ListingDetailListing
  orgSlug: string
}) {
  const { listing, orgSlug } = opts
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

  return (
    <ListingDetailView
      listing={listing}
      listingPhotos={listingPhotos}
      carouselGroups={carouselGroups}
      orgSlug={orgSlug}
      listingCardCopy={listingCardCopyFromLanding()}
    />
  )
}

export async function loadPublishedListingBySlug(
  orgId: string,
  slug: string,
): Promise<ListingDetailListing | null> {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('listings')
    .select(LISTING_DETAIL_SELECT)
    .eq('slug', slug)
    .eq('org_id', orgId)
    .eq('status', 'published')
    .maybeSingle()
  return (data as ListingDetailListing | null) ?? null
}

export async function loadPublishedListingForProperty(
  orgId: string,
  propertyId: string,
): Promise<ListingDetailListing | null> {
  const supabase = createPublicClient()
  const { data: units } = await supabase
    .from('units')
    .select('id')
    .eq('property_id', propertyId)
    .eq('org_id', orgId)

  const unitIds = (units ?? []).map((u) => u.id)
  if (!unitIds.length) return null

  const { data } = await supabase
    .from('listings')
    .select(LISTING_DETAIL_SELECT)
    .eq('org_id', orgId)
    .eq('status', 'published')
    .in('unit_id', unitIds)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data as ListingDetailListing | null) ?? null
}

export async function renderPropertyPublicPage(opts: {
  property: PropertyPublicProperty
  orgSlug: string
  orgId: string
}) {
  const { property, orgSlug, orgId } = opts
  const supabase = createPublicClient()

  const [unitsRes, leaseEndRes, fromMedia, allPublished] = await Promise.all([
    supabase
      .from('units')
      .select('id, bedrooms, bathrooms, sq_footage, amenities, asking_rent, status')
      .eq('property_id', property.id)
      .eq('org_id', orgId)
      .order('unit_number', { ascending: true }),
    supabase.rpc('public_property_lease_end', { p_property_id: property.id }),
    getListingPhotoPathsForProperty(property.id),
    getPublishedListings(orgSlug),
  ])

  const unitRows = unitsRes.data ?? []
  const unit = (unitRows[0] as PropertyPublicUnit | null) ?? null
  const unitIds = unitRows.map((u) => u.id as string)

  // Pass published listing id when visible; draft/unlisted resolved in submitGeneralInterest.
  let linkedListingId: string | null = null
  if (unitIds.length) {
    const { data: publishedListing } = await supabase
      .from('listings')
      .select('id')
      .eq('org_id', orgId)
      .eq('status', 'published')
      .in('unit_id', unitIds)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    linkedListingId = publishedListing?.id ?? null
  }

  const leaseEnd =
    typeof leaseEndRes.data === 'string'
      ? leaseEndRes.data
      : leaseEndRes.data
        ? String(leaseEndRes.data)
        : null

  const unitLooksLeased =
    !!leaseEnd ||
    (unit?.status ?? '').toLowerCase() === 'leased' ||
    (unit?.status ?? '').toLowerCase() === 'occupied'

  const availabilityLabel = leaseEnd
    ? formatPropertyAvailabilityLabel(leaseEnd)
    : unitLooksLeased
      ? 'Currently leased'
      : 'Not currently available'

  const photoPaths: string[] = (
    fromMedia.length > 0 ? fromMedia : (property.photo_paths ?? [])
  ).filter((p: string) => !!p && !/^https?:\/\//i.test(p))
  const { all: photos } = await resolveListingGalleryPhotos(photoPaths)

  if (photos[0]) {
    preload(photos[0], { as: 'image', fetchPriority: 'high' })
  }

  // Show similar published homes only — never inject this leased property into carousels
  const carouselGroups = getDetailPageCarouselGroups(allPublished, '__property__', property.city)

  return (
    <PropertyPublicView
      property={property}
      unit={unit}
      photos={photos}
      availabilityLabel={availabilityLabel}
      carouselGroups={carouselGroups}
      orgSlug={orgSlug}
      orgId={orgId}
      linkedListingId={linkedListingId}
      listingCardCopy={listingCardCopyFromLanding()}
    />
  )
}

export async function loadPropertyBySlug(
  orgId: string,
  slug: string,
): Promise<PropertyPublicProperty | null> {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('properties')
    .select(PROPERTY_PUBLIC_SELECT)
    .eq('slug', slug)
    .eq('org_id', orgId)
    .maybeSingle()
  return (data as PropertyPublicProperty | null) ?? null
}
