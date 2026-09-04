import { publicPropertyLookupClient } from '@/lib/listings/public-property-lookup'
import { unstable_noStore as noStore } from 'next/cache'
import { getOrgBySlug } from '@/lib/orgs'
import {
  mapListingRow,
  type ListingRow,
} from '@/lib/listings/browse-utils'
import type { BrowseListing } from '@/lib/listings/browse-types'
import { getListingPhotoPathsByPropertyIds } from '@/lib/storage/property-listing-media'
import { signOrgAssetPaths } from '@/lib/storage/listing-photos'

type ListingFlat = {
  id: string
  slug: string | null
  listing_title: string
  listing_description: string | null
  display_rent: number | null
  highlights: string[] | null
  available_from: string | null
  created_at: string
  unit_id: string | null
}

type UnitFlat = {
  id: string
  bedrooms: number
  bathrooms: number
  asking_rent: number | null
  amenities: string[] | null
  property_id: string | null
}

type PropertyFlat = {
  id: string
  street_address: string
  city: string
  province: string
  photo_paths: string[] | null
  listing_brief: unknown
  property_type: string | null
}

/**
 * Same published inventory the landing page cards use.
 * Fetches listings, then units, then properties as separate queries so an
 * embed/RLS failure on properties cannot hide the listings themselves.
 */
export async function getPublishedListings(
  orgSlug = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ?? 'canary'
): Promise<BrowseListing[]> {
  noStore()
  const org = await getOrgBySlug(orgSlug)
  if (!org) return []

  const supabase = publicPropertyLookupClient()
  const { data: listingRows, error: listingError } = await supabase
    .from('listings')
    .select(
      'id, slug, listing_title, listing_description, display_rent, highlights, available_from, created_at, unit_id',
    )
    .eq('status', 'published')
    .eq('org_id', org.id)

  if (listingError) {
    console.error('[getPublishedListings] listings', listingError.message)
  }

  const listings = (listingRows ?? []) as ListingFlat[]
  if (listings.length === 0) return []

  const unitIds = listings
    .map((row) => row.unit_id)
    .filter((id): id is string => !!id)

  const unitsById = new Map<string, UnitFlat>()
  if (unitIds.length > 0) {
    const { data: unitRows, error: unitError } = await supabase
      .from('units')
      .select('id, bedrooms, bathrooms, asking_rent, amenities, property_id')
      .in('id', unitIds)
    if (unitError) {
      console.error('[getPublishedListings] units', unitError.message)
    }
    for (const unit of (unitRows ?? []) as UnitFlat[]) {
      unitsById.set(unit.id, unit)
    }
  }

  const propertyIds = [...new Set(
    [...unitsById.values()]
      .map((unit) => unit.property_id)
      .filter((id): id is string => !!id),
  )]

  const propertiesById = new Map<string, PropertyFlat>()
  if (propertyIds.length > 0) {
    const { data: propertyRows, error: propertyError } = await supabase
      .from('properties')
      .select('id, street_address, city, province, photo_paths, listing_brief, property_type')
      .in('id', propertyIds)
    if (propertyError) {
      console.error('[getPublishedListings] properties', propertyError.message)
    }
    for (const property of (propertyRows ?? []) as PropertyFlat[]) {
      propertiesById.set(property.id, property)
    }
  }

  const rows: ListingRow[] = listings.map((listing) => {
    const unit = listing.unit_id ? unitsById.get(listing.unit_id) : undefined
    const property = unit?.property_id ? propertiesById.get(unit.property_id) : undefined
    return {
      id: listing.id,
      slug: listing.slug,
      listing_title: listing.listing_title,
      listing_description: listing.listing_description,
      display_rent: listing.display_rent,
      highlights: listing.highlights,
      available_from: listing.available_from,
      created_at: listing.created_at,
      units: unit
        ? {
            id: unit.id,
            bedrooms: unit.bedrooms,
            bathrooms: unit.bathrooms,
            asking_rent: unit.asking_rent,
            amenities: unit.amenities,
            properties: property
              ? {
                  id: property.id,
                  street_address: property.street_address,
                  city: property.city,
                  province: property.province,
                  photo_paths: property.photo_paths,
                  listing_brief: property.listing_brief,
                  property_type: property.property_type,
                }
              : null,
          }
        : null,
    }
  })

  const resolvedPropertyIds = rows
    .map((r) => r.units?.properties?.id)
    .filter((id): id is string => !!id)

  const pathsByProperty = await getListingPhotoPathsByPropertyIds(
    resolvedPropertyIds,
    supabase,
  )

  const pathLists = rows.map((row) => {
    const propertyId = row.units?.properties?.id
    const fromMedia = propertyId ? pathsByProperty.get(propertyId) : undefined
    const fromLegacy = (row.units?.properties?.photo_paths ?? []).filter(
      (p): p is string => !!p && !/^https?:\/\//i.test(p)
    )
    return (fromMedia?.length ? fromMedia : fromLegacy) as string[]
  })

  const coverPaths = pathLists.map((paths) => paths[0] ?? '')
  const signedCovers = await signOrgAssetPaths(
    coverPaths,
    supabase,
    'getPublishedListings',
    'preview',
  )

  const orgQuery = orgSlug ? `?org=${orgSlug}` : ''

  return rows.map((row, index) => {
    const paths = pathLists[index]
    const cover = signedCovers[index] || null
    const mapped = mapListingRow(row, '', orgQuery, index)
    return {
      ...mapped,
      photo: cover,
      photos: cover ? [cover] : [],
      photoCount: paths.length,
    }
  })
}
