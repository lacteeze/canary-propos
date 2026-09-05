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
  status?: string | null
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
 * Uses public_units / public_properties so column-level grants cannot hide
 * homes, then signs covers with the service-role lookup.
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
      'id, slug, listing_title, listing_description, display_rent, highlights, available_from, status, created_at, unit_id',
    )
    .eq('status', 'published')
    .eq('org_id', org.id)
  if (listingsError) {
    console.error('[getPublishedListings:listings]', listingsError.message)
  }

  const listingRows = listings ?? []
  const unitIds = [
    ...new Set(
      listingRows
        .map((row) => row.unit_id)
        .filter((id): id is string => !!id),
    ),
  ]
  const unitsRes = unitIds.length
    ? await supabase
        .from('public_units')
        .select('id, bedrooms, bathrooms, amenities, property_id')
        .in('id', unitIds)
    : { data: [] as Array<{ id: string; bedrooms: number; bathrooms: number; amenities: string[] | null; property_id: string | null }>, error: null }
  if (unitsRes.error) {
    console.error('[getPublishedListings:units]', unitsRes.error.message)
  }
  const unitsById = new Map((unitsRes.data ?? []).map((u) => [u.id, u]))
  const propertyIds = [
    ...new Set(
      [...unitsById.values()]
        .map((u) => u.property_id)
        .filter((id): id is string => !!id),
    ),
  ]
  const propertiesRes = propertyIds.length
    ? await supabase
        .from('public_properties')
        .select('id, street_address, city, province, photo_paths, listing_brief')
        .in('id', propertyIds)
    : { data: [] as Array<{ id: string; street_address: string; city: string; province: string; photo_paths: string[] | null; listing_brief: unknown }>, error: null }
  if (propertiesRes.error) {
    console.error('[getPublishedListings:properties]', propertiesRes.error.message)
  }
  const propertiesById = new Map((propertiesRes.data ?? []).map((p) => [p.id, p]))

  const rows: ListingRow[] = listingRows.map((listing) => {
    const unit = listing.unit_id ? unitsById.get(listing.unit_id) : undefined
    const property = unit?.property_id ? propertiesById.get(unit.property_id) : undefined
    return {
      ...listing,
      units: unit
        ? {
            id: unit.id,
            bedrooms: unit.bedrooms,
            bathrooms: unit.bathrooms,
            asking_rent: null,
            amenities: unit.amenities,
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
  })

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
