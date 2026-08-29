import type { PropertyPublicProperty } from '@/components/listings/PropertyPublicView'
import { unitLooksLeased } from '@/lib/listings/public-property-page'
import { publicSlugLookupCandidates } from '@/lib/listings/slug-aliases'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPublicClient } from '@/lib/supabase/public'

export const PROPERTY_PUBLIC_SELECT = `
  id,
  slug,
  street_address,
  city,
  province,
  photo_paths,
  property_type,
  listing_brief
`

type LookupClient = ReturnType<typeof createAdminClient> | ReturnType<typeof createPublicClient>

/**
 * Public pages must not call RPCs that may be missing in production:
 * PostgREST 404s for unknown functions can surface as the Next.js error/404 page.
 * Service-role lookup bypasses anon listing RLS so unpublished (leased) URLs resolve.
 */
export function publicPropertyLookupClient(): LookupClient {
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) return createAdminClient()
  } catch (err) {
    console.error('[publicPropertyLookupClient]', err)
  }
  return createPublicClient()
}

function pickPreferredSlugRow<T extends { slug?: string | null }>(
  rows: T[],
  requestedSlug: string,
): T | null {
  if (!rows.length) return null
  const exact = rows.find((row) => row.slug === requestedSlug)
  if (exact) return exact
  const candidates = publicSlugLookupCandidates(requestedSlug)
  const aliased = rows.find((row) => row.slug && candidates.includes(row.slug))
  return aliased ?? rows[0] ?? null
}

async function selectPublicProperty(
  client: LookupClient,
  orgId: string,
  column: 'id' | 'slug',
  value: string,
): Promise<PropertyPublicProperty | null> {
  const query = client
    .from('properties')
    .select(PROPERTY_PUBLIC_SELECT)
    .eq('org_id', orgId)

  const { data, error } =
    column === 'id'
      ? await query.eq('id', value).maybeSingle()
      : await (async () => {
          const candidates = publicSlugLookupCandidates(value)
          if (!candidates.length) return { data: [] as PropertyPublicProperty[], error: null }
          return query.in('slug', candidates)
        })()

  if (error) {
    console.error(`[selectPublicProperty:${column}]`, error.message)
    return null
  }
  if (column === 'id') return (data as PropertyPublicProperty | null) ?? null
  const rows = (Array.isArray(data) ? data : data ? [data] : []) as PropertyPublicProperty[]
  return pickPreferredSlugRow(rows, value)
}

async function loadPropertyByUnitId(
  client: LookupClient,
  orgId: string,
  unitId: string | null | undefined,
): Promise<PropertyPublicProperty | null> {
  if (!unitId) return null
  const { data: unit, error } = await client
    .from('units')
    .select('property_id')
    .eq('id', unitId)
    .maybeSingle()
  if (error) {
    console.error('[loadPropertyByUnitId]', error.message)
    return null
  }
  if (!unit?.property_id) return null
  return selectPublicProperty(client, orgId, 'id', unit.property_id)
}

export async function loadPropertyBySlug(
  orgId: string,
  slug: string,
): Promise<PropertyPublicProperty | null> {
  return selectPublicProperty(publicPropertyLookupClient(), orgId, 'slug', slug)
}

export async function loadPropertyById(
  orgId: string,
  propertyId: string,
): Promise<PropertyPublicProperty | null> {
  return selectPublicProperty(publicPropertyLookupClient(), orgId, 'id', propertyId)
}

/** Property for a public slug, including unpublished listing slugs. */
export async function loadPropertyForPublicSlug(
  orgId: string,
  slug: string,
): Promise<PropertyPublicProperty | null> {
  const client = publicPropertyLookupClient()
  const bySlug = await selectPublicProperty(client, orgId, 'slug', slug)
  if (bySlug) return bySlug

  const { data: listings, error } = await client
    .from('listings')
    .select('unit_id, slug')
    .eq('org_id', orgId)
    .in('slug', publicSlugLookupCandidates(slug))
  if (error) {
    console.error('[loadPropertyForPublicSlug:listing]', error.message)
    return null
  }
  const listing = pickPreferredSlugRow(listings ?? [], slug)
  return loadPropertyByUnitId(client, orgId, listing?.unit_id)
}

/** Property for a listing UUID after the listing is unlisted. */
export async function loadPropertyForListingId(
  orgId: string,
  listingId: string,
): Promise<PropertyPublicProperty | null> {
  const client = publicPropertyLookupClient()
  const { data: listing, error } = await client
    .from('listings')
    .select('unit_id')
    .eq('id', listingId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) {
    console.error('[loadPropertyForListingId]', error.message)
    return null
  }
  return loadPropertyByUnitId(client, orgId, listing?.unit_id)
}

/** Active lease end for a unit — used on published listing details. No tenant PII. */
export async function loadUnitActiveLeaseEnd(
  unitId: string | null | undefined,
): Promise<string | null> {
  if (!unitId) return null
  const client = publicPropertyLookupClient()
  const { data, error } = await client
    .from('leases')
    .select('end_date')
    .eq('unit_id', unitId)
    .eq('status', 'active')
    .not('end_date', 'is', null)
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[loadUnitActiveLeaseEnd]', error.message)
    return null
  }
  return data?.end_date ?? null
}

export async function publicPropertyIsLeased(propertyId: string): Promise<boolean> {
  const client = publicPropertyLookupClient()
  const { data: units, error: unitsError } = await client
    .from('units')
    .select('id, status')
    .eq('property_id', propertyId)
  if (unitsError) {
    console.error('[publicPropertyIsLeased:units]', unitsError.message)
  }
  const unitRows = units ?? []
  if (unitRows.some((row) => unitLooksLeased(row.status))) return true

  const unitIds = unitRows.map((row) => row.id).filter(Boolean)
  if (!unitIds.length) return false

  const { data: leases, error } = await client
    .from('leases')
    .select('id')
    .eq('status', 'active')
    .in('unit_id', unitIds)
    .limit(1)
  if (error) {
    console.error('[publicPropertyIsLeased:leases]', error.message)
    return false
  }
  return (leases?.length ?? 0) > 0
}
