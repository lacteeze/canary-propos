import type { SupabaseClient } from '@supabase/supabase-js'
import { isReservedListingSlug } from './reserved-slugs'

const MAX_SUFFIX_ATTEMPTS = 50

/** First comma segment → lowercase kebab; empty/invalid → fallback. */
export function slugifyAddress(
  streetAddress: string,
  emptyFallback: 'listing' | 'property' = 'listing',
): string {
  const firstSegment = streetAddress.split(',')[0] ?? ''
  const slug = firstSegment
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

  return slug.length > 0 ? slug : emptyFallback
}

function idPrefix(id: string): string {
  return id.replace(/-/g, '').slice(0, 8)
}

async function takenListingSlugs(
  supabase: SupabaseClient,
  orgId: string,
  excludeListingId?: string,
): Promise<Set<string>> {
  const { data: existing, error } = await supabase
    .from('listings')
    .select('id, slug')
    .eq('org_id', orgId)
    .not('slug', 'is', null)

  if (error) {
    throw new Error(`Failed to load listing slugs: ${error.message}`)
  }

  const taken = new Set<string>()
  for (const row of existing ?? []) {
    if (!row.slug) continue
    if (excludeListingId && row.id === excludeListingId) continue
    taken.add(row.slug)
  }
  return taken
}

async function takenPropertySlugs(
  supabase: SupabaseClient,
  orgId: string,
  excludePropertyId?: string,
): Promise<Set<string>> {
  const { data: existing, error } = await supabase
    .from('properties')
    .select('id, slug')
    .eq('org_id', orgId)
    .not('slug', 'is', null)

  if (error) {
    throw new Error(`Failed to load property slugs: ${error.message}`)
  }

  const taken = new Set<string>()
  for (const row of existing ?? []) {
    if (!row.slug) continue
    if (excludePropertyId && row.id === excludePropertyId) continue
    taken.add(row.slug)
  }
  return taken
}

function pickCandidate(
  base: string,
  emptyFallback: 'listing' | 'property',
  taken: Set<string>,
  fallbackId: string,
): string {
  const candidates: string[] = []
  if (!isReservedListingSlug(base) && base !== 'listing' && base !== 'property') {
    candidates.push(base)
  }
  for (let n = 2; n <= MAX_SUFFIX_ATTEMPTS + 1; n++) {
    candidates.push(`${base}-${n}`)
  }
  candidates.push(`${emptyFallback}-${idPrefix(fallbackId)}`)

  for (const candidate of candidates) {
    if (isReservedListingSlug(candidate)) continue
    if (taken.has(candidate)) continue
    return candidate
  }

  return `${emptyFallback}-${idPrefix(fallbackId)}-${Date.now().toString(36)}`
}

export async function allocateUniqueListingSlug(opts: {
  supabase: SupabaseClient
  orgId: string
  streetAddress: string
  excludeListingId?: string
}): Promise<string> {
  const { supabase, orgId, streetAddress, excludeListingId } = opts
  const base = slugifyAddress(streetAddress, 'listing')
  const taken = await takenListingSlugs(supabase, orgId, excludeListingId)
  const fallbackId =
    excludeListingId ??
    `tmp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  return pickCandidate(base, 'listing', taken, fallbackId)
}

/**
 * Allocate a stable property slug. Avoids other property slugs and listing
 * slugs belonging to units on *other* properties (so /{slug} is not shadowed).
 */
export async function allocateUniquePropertySlug(opts: {
  supabase: SupabaseClient
  orgId: string
  streetAddress: string
  excludePropertyId?: string
}): Promise<string> {
  const { supabase, orgId, streetAddress, excludePropertyId } = opts
  const base = slugifyAddress(streetAddress, 'property')

  const [propertyTaken, listingRows] = await Promise.all([
    takenPropertySlugs(supabase, orgId, excludePropertyId),
    supabase
      .from('listings')
      .select('id, slug, units!unit_id(property_id)')
      .eq('org_id', orgId)
      .not('slug', 'is', null)
      .then(({ data, error }) => {
        if (error) throw new Error(`Failed to load listing slugs: ${error.message}`)
        return data ?? []
      }),
  ])

  const taken = new Set(propertyTaken)
  for (const row of listingRows) {
    if (!row.slug) continue
    const unit = row.units as { property_id?: string } | { property_id?: string }[] | null
    const propertyId = Array.isArray(unit) ? unit[0]?.property_id : unit?.property_id
    if (excludePropertyId && propertyId === excludePropertyId) continue
    taken.add(row.slug)
  }

  const fallbackId =
    excludePropertyId ??
    `tmp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  return pickCandidate(base, 'property', taken, fallbackId)
}

/** Prefer property.slug when free among listings; otherwise allocate. */
export async function allocateListingSlugPreferProperty(opts: {
  supabase: SupabaseClient
  orgId: string
  streetAddress: string
  propertySlug?: string | null
  excludeListingId?: string
}): Promise<string> {
  const { supabase, orgId, streetAddress, propertySlug, excludeListingId } = opts
  if (propertySlug && !isReservedListingSlug(propertySlug)) {
    const taken = await takenListingSlugs(supabase, orgId, excludeListingId)
    if (!taken.has(propertySlug)) return propertySlug
  }
  return allocateUniqueListingSlug({
    supabase,
    orgId,
    streetAddress,
    excludeListingId,
  })
}
