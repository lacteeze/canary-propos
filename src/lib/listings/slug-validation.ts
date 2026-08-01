import type { SupabaseClient } from '@supabase/supabase-js'
import { isListingUuid } from './listing-href'
import { isReservedListingSlug } from './reserved-slugs'

/** Lowercase alphanumeric segments separated by single hyphens (max 80). */
const PUBLIC_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function normalizePublicSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

export type PublicSlugValidation =
  | { ok: true; slug: string }
  | { ok: false; error: string }

/** Validate a candidate public URL slug (format + reserved paths). */
export function validatePublicSlug(raw: string): PublicSlugValidation {
  const slug = normalizePublicSlug(raw)
  if (!slug) {
    return { ok: false, error: 'Slug is required.' }
  }
  if (!PUBLIC_SLUG_RE.test(slug)) {
    return {
      ok: false,
      error: 'Use lowercase letters, numbers, and hyphens only (e.g. 151-a-signal-hill-rd).',
    }
  }
  if (isReservedListingSlug(slug)) {
    return { ok: false, error: `"${slug}" is reserved for the app and cannot be used.` }
  }
  if (isListingUuid(slug)) {
    return { ok: false, error: 'Slug cannot look like a UUID.' }
  }
  return { ok: true, slug }
}

/**
 * True when another property or listing in the org already uses this slug.
 * Pass exclude IDs for the property / listings being renamed (sync targets).
 */
export async function isPublicSlugTaken(opts: {
  supabase: SupabaseClient
  orgId: string
  slug: string
  excludePropertyId?: string
  excludeListingIds?: string[]
}): Promise<{ taken: boolean; by: 'property' | 'listing' | null }> {
  const { supabase, orgId, slug, excludePropertyId, excludeListingIds } = opts
  const excludeListings = new Set(excludeListingIds ?? [])

  const [propsRes, listingsRes] = await Promise.all([
    supabase.from('properties').select('id, slug').eq('org_id', orgId).eq('slug', slug),
    supabase.from('listings').select('id, slug').eq('org_id', orgId).eq('slug', slug),
  ])

  if (propsRes.error) {
    throw new Error(`Failed to check property slugs: ${propsRes.error.message}`)
  }
  if (listingsRes.error) {
    throw new Error(`Failed to check listing slugs: ${listingsRes.error.message}`)
  }

  for (const row of propsRes.data ?? []) {
    if (excludePropertyId && row.id === excludePropertyId) continue
    return { taken: true, by: 'property' }
  }
  for (const row of listingsRes.data ?? []) {
    if (excludeListings.has(row.id)) continue
    return { taken: true, by: 'listing' }
  }
  return { taken: false, by: null }
}
