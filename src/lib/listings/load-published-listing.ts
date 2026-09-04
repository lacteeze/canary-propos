import type { ListingDetailListing } from '@/components/listings/ListingDetailView'
import { publicSlugLookupCandidates } from '@/lib/listings/slug-aliases'
import { createPublicClient } from '@/lib/supabase/public'

/** Listing columns only — never embed units/properties (column grants break PostgREST embeds). */
export const PUBLISHED_LISTING_SELECT = `
  id,
  org_id,
  unit_id,
  slug,
  listing_title,
  listing_description,
  highlights,
  display_rent,
  available_from,
  available_until,
  status
`

export type PublishedListingRow = {
  id: string
  org_id: string
  unit_id: string | null
  slug: string | null
  listing_title: string
  listing_description: string | null
  highlights: string[] | null
  display_rent: number | null
  available_from: string | null
  available_until: string | null
  status: string
}

type PublicUnitRow = {
  id: string
  property_id: string | null
  bedrooms: number | null
  bathrooms: number | null
  sq_footage: number | null
  amenities: string[] | null
  status: string | null
  asking_rent?: number | null
  hospitable_widget_property_id: string | null
}

type PublicPropertyRow = {
  id: string
  street_address: string
  city: string
  province: string
  photo_paths: string[] | null
  listing_brief: unknown
}

export function assembleListingDetail(
  listing: PublishedListingRow,
  unit: PublicUnitRow | null,
  property: PublicPropertyRow | null,
): ListingDetailListing {
  return {
    id: listing.id,
    org_id: listing.org_id,
    unit_id: listing.unit_id,
    slug: listing.slug,
    listing_title: listing.listing_title,
    listing_description: listing.listing_description,
    highlights: listing.highlights,
    display_rent: listing.display_rent,
    available_from: listing.available_from,
    available_until: listing.available_until,
    status: listing.status,
    units: unit
      ? {
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          sq_footage: unit.sq_footage,
          amenities: unit.amenities,
          asking_rent: unit.asking_rent ?? null,
          status: unit.status,
          hospitable_widget_property_id: unit.hospitable_widget_property_id,
          properties: property
            ? {
                id: property.id,
                street_address: property.street_address,
                city: property.city,
                province: property.province,
                photo_paths: property.photo_paths,
                listing_brief: property.listing_brief,
              }
            : null,
        }
      : null,
  }
}

async function loadPublicUnit(
  supabase: ReturnType<typeof createPublicClient>,
  unitId: string | null | undefined,
): Promise<PublicUnitRow | null> {
  if (!unitId) return null
  const { data, error } = await supabase
    .from('public_units')
    .select(
      'id, property_id, bedrooms, bathrooms, sq_footage, amenities, status, hospitable_widget_property_id',
    )
    .eq('id', unitId)
    .maybeSingle()
  if (error) {
    console.error('[loadPublicUnit]', error.message)
    return null
  }
  return (data as PublicUnitRow | null) ?? null
}

async function loadPublicProperty(
  supabase: ReturnType<typeof createPublicClient>,
  propertyId: string | null | undefined,
): Promise<PublicPropertyRow | null> {
  if (!propertyId) return null
  const { data, error } = await supabase
    .from('public_properties')
    .select('id, street_address, city, province, photo_paths, listing_brief')
    .eq('id', propertyId)
    .maybeSingle()
  if (error) {
    console.error('[loadPublicProperty]', error.message)
    return null
  }
  return (data as PublicPropertyRow | null) ?? null
}

export async function hydratePublishedListing(
  listing: PublishedListingRow,
): Promise<ListingDetailListing> {
  const supabase = createPublicClient()
  const unit = await loadPublicUnit(supabase, listing.unit_id)
  const property = await loadPublicProperty(supabase, unit?.property_id)
  return assembleListingDetail(listing, unit, property)
}

function asListingRow(data: unknown): PublishedListingRow | null {
  if (!data || typeof data !== 'object') return null
  const row = data as PublishedListingRow
  if (!row.id || !row.status) return null
  return row
}

export async function loadPublishedListingBySlug(
  orgId: string,
  slug: string,
): Promise<ListingDetailListing | null> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('listings')
    .select(PUBLISHED_LISTING_SELECT)
    .eq('org_id', orgId)
    .eq('status', 'published')
    .in('slug', publicSlugLookupCandidates(slug))
  if (error) {
    console.error('[loadPublishedListingBySlug]', error.message)
    return null
  }
  const rows = ((data ?? []) as PublishedListingRow[]).filter((row) => row.id)
  const match = rows.find((row) => row.slug === slug) ?? rows[0]
  if (!match) return null
  return hydratePublishedListing(match)
}

export async function loadPublishedListingById(
  orgId: string,
  id: string,
): Promise<ListingDetailListing | null> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('listings')
    .select(PUBLISHED_LISTING_SELECT)
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('status', 'published')
    .maybeSingle()
  if (error) {
    console.error('[loadPublishedListingById]', error.message)
    return null
  }
  const row = asListingRow(data)
  if (!row) return null
  return hydratePublishedListing(row)
}

export async function loadPublishedListingForProperty(
  orgId: string,
  propertyId: string,
): Promise<ListingDetailListing | null> {
  const supabase = createPublicClient()
  const { data: units, error: unitsError } = await supabase
    .from('public_units')
    .select('id')
    .eq('property_id', propertyId)
  if (unitsError) {
    console.error('[loadPublishedListingForProperty:units]', unitsError.message)
    return null
  }

  const unitIds = (units ?? []).map((u) => u.id).filter(Boolean)
  if (!unitIds.length) return null

  const { data, error } = await supabase
    .from('listings')
    .select(PUBLISHED_LISTING_SELECT)
    .eq('org_id', orgId)
    .eq('status', 'published')
    .in('unit_id', unitIds)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[loadPublishedListingForProperty:listing]', error.message)
    return null
  }
  const row = asListingRow(data)
  if (!row) return null
  return hydratePublishedListing(row)
}
