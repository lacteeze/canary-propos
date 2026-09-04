import { createPublicClient } from '@/lib/supabase/public'
import { unstable_noStore as noStore } from 'next/cache'
import { getOrgBySlug } from '@/lib/orgs'
import {
  mapListingRow,
  type ListingRow,
} from '@/lib/listings/browse-utils'
import type { BrowseListing } from '@/lib/listings/browse-types'
import { getListingPhotoPathsByPropertyIds } from '@/lib/storage/property-listing-media'
import { signListingPhotoPaths } from '@/lib/storage/listing-photos'

export async function getPublishedListings(
  orgSlug = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ?? 'canary'
): Promise<BrowseListing[]> {
  noStore()
  const org = await getOrgBySlug(orgSlug)
  if (!org) return []

  const supabase = createPublicClient()
  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select(
      `id, slug, listing_title, listing_description, display_rent, highlights, available_from, status, created_at, unit_id`,
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

  const pathsByProperty = await getListingPhotoPathsByPropertyIds(propertyIds)

  const pathLists = rows.map((row) => {
    const propertyId = row.units?.properties?.id
    const fromMedia = propertyId ? pathsByProperty.get(propertyId) : undefined
    const fromLegacy = (row.units?.properties?.photo_paths ?? []).filter(
      (p): p is string => !!p && !/^https?:\/\//i.test(p)
    )
    return (fromMedia?.length ? fromMedia : fromLegacy) as string[]
  })

  // Sign only covers on initial load — remaining gallery URLs load on first carousel click.
  const coverPaths = pathLists.map((paths) => paths[0] ?? '')
  const signedCovers = await signListingPhotoPaths(coverPaths, 'preview')

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
