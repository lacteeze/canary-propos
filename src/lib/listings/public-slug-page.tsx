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
  unitLooksLeased,
} from '@/lib/listings/public-property-page'
import { createPublicClient } from '@/lib/supabase/public'
import { getListingPhotoPathsForProperty } from '@/lib/storage/property-listing-media'
import { resolveListingGalleryPhotos } from '@/lib/storage/listing-photos'
import { getHospitableSiteUuid } from '@/lib/hospitable/site-uuid'

const PROPERTY_PUBLIC_SELECT = `
  id,
  slug,
  street_address,
  city,
  province,
  photo_paths,
  property_type,
  listing_brief
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

function listingPropertyId(listing: ListingDetailListing): string | null {
  return listing.units?.properties?.id ?? null
}

export async function listingIsPubliclyAvailable(
  listing: ListingDetailListing,
): Promise<boolean> {
  const status = listing.units?.status ?? null
  if ((status ?? '').toLowerCase() === 'str') return true
  if (unitLooksLeased(status)) return false
  const propertyId = listingPropertyId(listing)
  if (!propertyId) return true
  return !(await publicPropertyIsLeased(propertyId))
}

async function publicPropertyIsLeased(propertyId: string): Promise<boolean> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('public_property_is_leased', {
    p_property_id: propertyId,
  })
  if (error) {
    console.error('[publicPropertyIsLeased]', error.message)
    return false
  }
  return data === true
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
    <ListingDetailView
      listing={listing}
      listingPhotos={listingPhotos}
      listingPhotosFull={listingPhotosFull}
      carouselGroups={carouselGroups}
      orgSlug={orgSlug}
      hospitableSiteUuid={hospitableSiteUuid}
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

  const [unitsRes, leasedRes, fromMedia, allPublished] = await Promise.all([
    supabase
      .from('units')
      .select(
        'id, bedrooms, bathrooms, sq_footage, amenities, status, hospitable_widget_property_id'
      )
      .eq('property_id', property.id)
      .eq('org_id', orgId)
      .order('unit_number', { ascending: true }),
    supabase.rpc('public_property_is_leased', { p_property_id: property.id }),
    getListingPhotoPathsForProperty(property.id),
    getPublishedListings(orgSlug),
  ])

  if (unitsRes.error) {
    console.error('[renderPropertyPublicPage:units]', unitsRes.error.message)
  }
  if (leasedRes.error) {
    console.error('[renderPropertyPublicPage:leased]', leasedRes.error.message)
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

  const leased =
    leasedRes.data === true ||
    unitRows.some((row) => unitLooksLeased(row.status as string | null))
  const availabilityLabel = propertyAvailabilityLabel(leased)

  const photoPaths: string[] = (
    fromMedia.length > 0 ? fromMedia : (property.photo_paths ?? [])
  ).filter((p: string) => !!p && !/^https?:\/\//i.test(p))
  const { all: photos, full: photosFull } = await resolveListingGalleryPhotos(photoPaths)

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

export async function loadPropertyById(
  orgId: string,
  propertyId: string,
): Promise<PropertyPublicProperty | null> {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('properties')
    .select(PROPERTY_PUBLIC_SELECT)
    .eq('id', propertyId)
    .eq('org_id', orgId)
    .maybeSingle()
  return (data as PropertyPublicProperty | null) ?? null
}

/** Property for a public slug, including unpublished listing slugs (SECURITY DEFINER RPC). */
export async function loadPropertyForPublicSlug(
  orgId: string,
  slug: string,
): Promise<PropertyPublicProperty | null> {
  const bySlug = await loadPropertyBySlug(orgId, slug)
  if (bySlug) return bySlug

  const supabase = createPublicClient()
  const { data: propertyId, error } = await supabase.rpc('public_property_id_for_slug', {
    p_org_id: orgId,
    p_slug: slug,
  })
  if (error) {
    console.error('[loadPropertyForPublicSlug]', error.message)
    return null
  }
  if (!propertyId) return null
  return loadPropertyById(orgId, propertyId)
}

/** Property for a listing UUID after the listing is unlisted (SECURITY DEFINER RPC). */
export async function loadPropertyForListingId(
  orgId: string,
  listingId: string,
): Promise<PropertyPublicProperty | null> {
  const supabase = createPublicClient()
  const { data: propertyId, error } = await supabase.rpc('public_property_id_for_listing', {
    p_org_id: orgId,
    p_listing_id: listingId,
  })
  if (error) {
    console.error('[loadPropertyForListingId]', error.message)
    return null
  }
  if (!propertyId) return null
  return loadPropertyById(orgId, propertyId)
}

export async function loadPropertyFromListing(
  orgId: string,
  listing: ListingDetailListing,
): Promise<PropertyPublicProperty | null> {
  const propertyId = listingPropertyId(listing)
  if (propertyId) return loadPropertyById(orgId, propertyId)
  return loadPropertyForListingId(orgId, listing.id)
}
