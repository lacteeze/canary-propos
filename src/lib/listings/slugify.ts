import type { SupabaseClient } from '@supabase/supabase-js'
import { isReservedListingSlug } from './reserved-slugs'

const MAX_SUFFIX_ATTEMPTS = 50

/** First comma segment → lowercase kebab; empty/invalid → "listing". */
export function slugifyAddress(streetAddress: string): string {
  const firstSegment = streetAddress.split(',')[0] ?? ''
  const slug = firstSegment
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

  return slug.length > 0 ? slug : 'listing'
}

function listingIdPrefix(id: string): string {
  return id.replace(/-/g, '').slice(0, 8)
}

export async function allocateUniqueListingSlug(opts: {
  supabase: SupabaseClient
  orgId: string
  streetAddress: string
  excludeListingId?: string
}): Promise<string> {
  const { supabase, orgId, streetAddress, excludeListingId } = opts
  const base = slugifyAddress(streetAddress)

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

  const candidates: string[] = []
  if (!isReservedListingSlug(base) && base !== 'listing') {
    candidates.push(base)
  }
  for (let n = 2; n <= MAX_SUFFIX_ATTEMPTS + 1; n++) {
    candidates.push(`${base}-${n}`)
  }

  const fallbackId =
    excludeListingId ??
    `tmp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  candidates.push(`listing-${listingIdPrefix(fallbackId)}`)

  for (const candidate of candidates) {
    if (isReservedListingSlug(candidate)) continue
    if (taken.has(candidate)) continue
    return candidate
  }

  // Extremely unlikely: append random suffix
  return `listing-${listingIdPrefix(fallbackId)}-${Date.now().toString(36)}`
}
