import { createPublicClient } from '@/lib/supabase/public'
import { getOrgBySlug } from '@/lib/orgs'
import type { LandingListing } from './content'
import { deriveTermTypeFromHighlights } from './listing-term'
import { getListingPhotoPathsByPropertyIds } from '@/lib/storage/property-listing-media'
import { signListingPhotoPaths } from '@/lib/storage/listing-photos'
import { listingPublicHref } from '@/lib/listings/listing-href'

function formatCAD(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(amount)
}

function shortAddress(address: string): string {
  return address.split(',')[0]?.trim() ?? address
}

export async function getFeaturedListings(
  orgSlug = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ?? 'canary',
  limit = 6
): Promise<LandingListing[]> {
  const org = await getOrgBySlug(orgSlug)
  if (!org) return []

  const supabase = createPublicClient()
  const { data: listings } = await supabase
    .from('listings')
    .select(
      `id, slug, listing_title, display_rent, highlights, available_from, status, unit_id`,
    )
    .eq('status', 'published')
    .eq('org_id', org.id)
    .limit(limit)

  const listingRows = listings ?? []
  const unitIds = [
    ...new Set(
      listingRows
        .map((row) => row.unit_id)
        .filter((id): id is string => !!id),
    ),
  ]
  const { data: units } = unitIds.length
    ? await supabase
        .from('public_units')
        .select('id, bedrooms, bathrooms, amenities, property_id')
        .in('id', unitIds)
    : { data: [] as Array<{ id: string; bedrooms: number; bathrooms: number; amenities: string[] | null; property_id: string | null }> }
  const unitsById = new Map((units ?? []).map((u) => [u.id, u]))
  const propertyIds = [
    ...new Set(
      [...unitsById.values()]
        .map((u) => u.property_id)
        .filter((id): id is string => !!id),
    ),
  ]
  const { data: properties } = propertyIds.length
    ? await supabase
        .from('public_properties')
        .select('id, street_address, city, photo_paths')
        .in('id', propertyIds)
    : { data: [] as Array<{ id: string; street_address: string; city: string; photo_paths: string[] | null }> }
  const propertiesById = new Map((properties ?? []).map((p) => [p.id, p]))

  const rows = listingRows.map((listing) => {
    const unit = listing.unit_id ? unitsById.get(listing.unit_id) : undefined
    const property = unit?.property_id ? propertiesById.get(unit.property_id) : undefined
    return {
      ...listing,
      units: unit
        ? {
            bedrooms: unit.bedrooms,
            bathrooms: unit.bathrooms,
            asking_rent: null as number | null,
            amenities: unit.amenities,
            properties: property ?? null,
          }
        : null,
    }
  })

  const pathsByProperty = await getListingPhotoPathsByPropertyIds(propertyIds)
  const coverPaths = rows.map((listing) => {
    const unit = listing.units as {
      properties?: { id?: string; photo_paths?: string[] | null } | null
    } | null
    const property = unit?.properties
    const fromMedia = property?.id ? pathsByProperty.get(property.id)?.[0] : undefined
    const legacy = property?.photo_paths?.find((p) => p && !/^https?:\/\//i.test(p))
    return fromMedia || legacy || null
  })
  const signedCovers = await signListingPhotoPaths(
    coverPaths.map((p) => p ?? ''),
    'preview'
  )
  const orgQuery = orgSlug ? `?org=${orgSlug}` : ''

  return rows.map((listing, index) => {
    const unit = listing.units as {
      bedrooms: number
      bathrooms: number
      asking_rent: number | null
      amenities: string[] | null
      properties: {
        street_address: string
        city: string
        photo_paths: string[] | null
      } | null
    } | null

    const property = unit?.properties
    const rentN = listing.display_rent ?? unit?.asking_rent ?? 0
    const address = property?.street_address ?? listing.listing_title
    const amenities = unit?.amenities?.join(' ') ?? ''
    const petFriendly = /pet|dog|cat|friendly/i.test(amenities)

    return {
      id: listing.id,
      short: shortAddress(address),
      rent: rentN ? formatCAD(rentN) : '—',
      rentN,
      beds: String(unit?.bedrooms ?? '—'),
      baths: String(unit?.bathrooms ?? '—').replace(/\.0$/, ''),
      extra: petFriendly ? '🐾 pet friendly' : (property?.city ?? ''),
      termType: deriveTermTypeFromHighlights(listing.highlights),
      photo: signedCovers[index] || null,
      href: listingPublicHref({ id: listing.id, slug: listing.slug }, orgQuery),
    }
  })
}
