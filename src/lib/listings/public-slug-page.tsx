import { preload } from 'react-dom'
import {
  LISTING_DETAIL_SELECT,
  ListingDetailView,
  type ListingDetailListing,
} from '@/components/listings/ListingDetailView'
import {
  PropertyPublicView,
  type PropertyPublicProperty,
  type PropertyPublicUnit,
} from '@/components/listings/PropertyPublicView'
import { getLandingCopy } from '@/lib/landing/content'
import { getPublishedListings } from '@/lib/landing/get-published-listings'
import { getDetailPageCarouselGroups } from '@/lib/listings/browse-utils'
import {
  propertyAvailabilityLabel,
  publishedListingIsListed,
  unitLooksLeased,
} from '@/lib/listings/public-property-page'
import {
  loadPropertyById,
  loadPropertyForListingId,
  publicPropertyIsLeased,
  publicPropertyLookupClient,
} from '@/lib/listings/public-property-lookup'
import { publicSlugLookupCandidates } from '@/lib/listings/slug-aliases'
import { createPublicClient } from '@/lib/supabase/public'
import { getListingPhotoPathsForProperty } from '@/lib/storage/property-listing-media'
import { resolveListingGalleryPhotos } from '@/lib/storage/listing-photos'
import { getHospitableSiteUuid } from '@/lib/hospitable/site-uuid'
import { listingOfferJsonLd } from '@/lib/listing-groups/listing-offer-jsonld'

export {
  loadPropertyById,
  loadPropertyBySlug,
  loadPropertyForListingId,
  loadPropertyForPublicSlug,
} from '@/lib/listings/public-property-lookup'

function listingCardCopyFromLanding() {
  const cardCopy = getLandingCopy('en')
  return {
    tBed: cardCopy.tBed,
    tBath: cardCopy.tBath,
    tPark: cardCopy.tPark,
    tAvailable: cardCopy.tAvailable,
    longTerm: cardCopy.longTerm,
    midTerm: cardCopy.midTerm,
  }
}

function listingPropertyId(listing: ListingDetailListing): string | null {
  return listing.units?.properties?.id ?? null
}

/** Published listings are listed; occupancy is ignored (available now / soon). */
export function listingIsPubliclyAvailable(listing: ListingDetailListing): boolean {
  return publishedListingIsListed(listing.status)
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
  const [{ all: listingPhotos, full: listingPhotosFull }, allPublished] = await Promise.all([
    galleryPromise,
    getPublishedListings(orgSlug),
  ])

  if (listingPhotos[0]) {
    preload(listingPhotos[0], { as: 'image', fetchPriority: 'high' })
  }

  const carouselGroups = getDetailPageCarouselGroups(allPublished, listing.id, listingCity)
  const widgetId = (unit?.hospitable_widget_property_id as string | null | undefined)?.trim()
  const hospitableSiteUuid = widgetId ? getHospitableSiteUuid() : null

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(listingOfferJsonLd(listing)) }}
      />
      <ListingDetailView
        listing={listing}
        listingPhotos={listingPhotos}
        listingPhotosFull={listingPhotosFull}
        carouselGroups={carouselGroups}
        orgSlug={orgSlug}
        hospitableSiteUuid={hospitableSiteUuid}
        listingCardCopy={listingCardCopyFromLanding()}
      />
    </>
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
    .eq('org_id', orgId)
    .eq('status', 'published')
    .in('slug', publicSlugLookupCandidates(slug))
  const rows = (data as ListingDetailListing[] | null) ?? []
  const exact = rows.find((row) => row.slug === slug)
  return exact ?? rows[0] ?? null
}

export async function loadPublishedListingById(
  orgId: string,
  id: string,
): Promise<ListingDetailListing | null> {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('listings')
    .select(LISTING_DETAIL_SELECT)
    .eq('id', id)
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
  const lookup = publicPropertyLookupClient()

  const [unitsRes, leased, fromMedia, allPublished] = await Promise.all([
    lookup
      .from('units')
      .select(
        'id, bedrooms, bathrooms, sq_footage, amenities, status, hospitable_widget_property_id'
      )
      .eq('property_id', property.id)
      .eq('org_id', orgId)
      .order('unit_number', { ascending: true }),
    publicPropertyIsLeased(property.id),
    getListingPhotoPathsForProperty(property.id, lookup),
    getPublishedListings(orgSlug),
  ])

  if (unitsRes.error) {
    console.error('[renderPropertyPublicPage:units]', unitsRes.error.message)
  }

  const unitRows = unitsRes.data ?? []
  const unit = (unitRows[0] as PropertyPublicUnit | null) ?? null
  const unitIds = unitRows.map((u) => u.id as string)
  const hospitableWidgetPropertyId =
    unitRows
      .map((u) => (u.hospitable_widget_property_id as string | null | undefined)?.trim())
      .find((id): id is string => !!id) ?? null
  const hospitableSiteUuid = hospitableWidgetPropertyId ? getHospitableSiteUuid() : null

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

  const availabilityLabel = propertyAvailabilityLabel(
    leased || unitRows.some((row) => unitLooksLeased(row.status as string | null)),
  )

  const photoPaths: string[] = (
    fromMedia.length > 0 ? fromMedia : (property.photo_paths ?? [])
  ).filter((p: string) => !!p && !/^https?:\/\//i.test(p))
  const { all: photos, full: photosFull } = await resolveListingGalleryPhotos(
    photoPaths,
    lookup,
  )

  if (photos[0]) {
    preload(photos[0], { as: 'image', fetchPriority: 'high' })
  }

  // Show similar published homes only — never inject this leased property into carousels
  const carouselGroups = getDetailPageCarouselGroups(
    allPublished,
    '__property__',
    property.city ?? "St. John's",
  )

  return (
    <PropertyPublicView
      property={property}
      unit={unit}
      photos={photos}
      photosFull={photosFull}
      availabilityLabel={availabilityLabel}
      carouselGroups={carouselGroups}
      orgSlug={orgSlug}
      orgId={orgId}
      linkedListingId={linkedListingId}
      hospitableWidgetPropertyId={hospitableWidgetPropertyId}
      hospitableSiteUuid={hospitableSiteUuid}
      listingCardCopy={listingCardCopyFromLanding()}
    />
  )
}

export async function loadPropertyFromListing(
  orgId: string,
  listing: ListingDetailListing,
): Promise<PropertyPublicProperty | null> {
  const propertyId = listingPropertyId(listing)
  if (propertyId) return loadPropertyById(orgId, propertyId)
  return loadPropertyForListingId(orgId, listing.id)
}
