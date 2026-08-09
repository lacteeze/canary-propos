// Match Hospitable STR properties to PropOS listing covers for Stay cards.
// Prefer org-assets signed preview URLs when listing photos exist; Hospitable
// `picture` is often an Airbnb/Hospitable thumbnail (aki_policy=small / thumb-*).

import { createPublicClient } from '@/lib/supabase/public'
import { getOrgBySlug } from '@/lib/orgs'
import type { HospitableProperty } from '@/lib/hospitable/client'
import {
  canonicalStreetKey,
  hospitablePropertyLabel,
  normalizeAddressKey,
} from '@/lib/hospitable/property-label'
import { getListingPhotoPathsByPropertyIds } from '@/lib/storage/property-listing-media'
import { signListingPhotoPaths } from '@/lib/storage/listing-photos'

export type StayCoverLookup = {
  byHospitableId: Map<string, string>
  byStreetKey: Map<string, string>
}

type UnitRow = {
  hospitable_property_id: string | null
  property_id: string
  properties: {
    id: string
    street_address: string
    slug: string | null
    photo_paths: string[] | null
  } | null
}

export function streetKeysForHospitableProperty(property: HospitableProperty): string[] {
  const keys = new Set<string>()
  const label = hospitablePropertyLabel(property)
  const labelKey = canonicalStreetKey(label)
  if (labelKey) keys.add(labelKey)

  const display = property.address?.display?.trim()
  if (display) {
    const displayKey = canonicalStreetKey(display)
    if (displayKey) keys.add(displayKey)
  }

  const name = (property.public_name || property.name || '').trim()
  if (name) {
    const nameKey = canonicalStreetKey(name)
    if (nameKey) keys.add(nameKey)
  }

  for (const siteUrl of property.bookings?.site_urls ?? []) {
    if (!siteUrl?.trim()) continue
    try {
      const path = new URL(siteUrl.trim()).pathname.replace(/^\/+|\/+$/g, '')
      const slug = path.split('/').filter(Boolean).pop() ?? ''
      // "14-bonaventure-avenue" → "14 bonaventure avenue" → canonical "14 bonaventure ave"
      const fromSlug = canonicalStreetKey(slug.replace(/-/g, ' '))
      if (fromSlug) keys.add(fromSlug)
    } catch {
      // ignore bad booking URLs
    }
  }

  return [...keys]
}

export function resolveStayCoverPath(
  property: HospitableProperty,
  lookup: StayCoverLookup
): string | null {
  const byId = lookup.byHospitableId.get(property.id)
  if (byId) return byId

  for (const key of streetKeysForHospitableProperty(property)) {
    const path = lookup.byStreetKey.get(key)
    if (path) return path
  }
  return null
}

/**
 * Load first listing cover path per PropOS property, indexed by Hospitable id
 * and canonical street key (for units that still lack hospitable_property_id).
 */
export async function loadStayCoverLookup(
  orgSlug = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ?? 'canary'
): Promise<StayCoverLookup> {
  const empty: StayCoverLookup = {
    byHospitableId: new Map(),
    byStreetKey: new Map(),
  }

  const org = await getOrgBySlug(orgSlug)
  if (!org) return empty

  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('units')
    .select(
      `hospitable_property_id, property_id,
       properties!property_id(id, street_address, slug, photo_paths)`
    )
    .eq('org_id', org.id)
    .is('archived_at', null)

  if (error) {
    console.error('[loadStayCoverLookup]', error.message)
    return empty
  }

  const rows = (data ?? []) as UnitRow[]
  const propertyIds = [
    ...new Set(
      rows
        .map((r) => r.properties?.id)
        .filter((id): id is string => !!id)
    ),
  ]
  const pathsByProperty = await getListingPhotoPathsByPropertyIds(propertyIds)

  const byHospitableId = new Map<string, string>()
  const byStreetKey = new Map<string, string>()

  for (const row of rows) {
    const property = row.properties
    if (!property?.id || !property.slug) continue

    const fromMedia = pathsByProperty.get(property.id) ?? []
    const fromLegacy = (property.photo_paths ?? []).filter(
      (p): p is string => !!p && !/^https?:\/\//i.test(p)
    )
    const cover = (fromMedia[0] || fromLegacy[0] || '').trim()
    if (!cover) continue

    const hospId = row.hospitable_property_id?.trim()
    if (hospId && !byHospitableId.has(hospId)) {
      byHospitableId.set(hospId, cover)
    }

    const street = canonicalStreetKey(property.street_address)
    if (street && !byStreetKey.has(street)) {
      byStreetKey.set(street, cover)
    }

    // Also index bare street without city noise already handled by canonicalStreetKey
    const short = property.street_address.split(',')[0]?.trim() ?? ''
    const shortKey = canonicalStreetKey(short)
    if (shortKey && !byStreetKey.has(shortKey)) {
      byStreetKey.set(shortKey, cover)
    }

    // Slug form e.g. 14-bonaventure-ave
    const slugKey = canonicalStreetKey(property.slug.replace(/-/g, ' '))
    if (slugKey && !byStreetKey.has(slugKey)) {
      byStreetKey.set(slugKey, cover)
    }

    // Normalize address key without suffix collapsing as extra hit
    const norm = normalizeAddressKey(short)
    if (norm && !byStreetKey.has(norm)) {
      byStreetKey.set(norm, cover)
    }
  }

  return { byHospitableId, byStreetKey }
}

/** Sign PropOS covers for a Hospitable property list; returns hospitable id → signed URL. */
export async function signStayCoverOverrides(
  properties: HospitableProperty[],
  lookup: StayCoverLookup
): Promise<Map<string, string>> {
  const pathByHospitableId = new Map<string, string>()
  for (const property of properties) {
    const path = resolveStayCoverPath(property, lookup)
    if (path) pathByHospitableId.set(property.id, path)
  }

  const uniquePaths = [...new Set(pathByHospitableId.values())]
  if (!uniquePaths.length) return new Map()

  const signed = await signListingPhotoPaths(uniquePaths, 'preview')
  const urlByPath = new Map<string, string>()
  uniquePaths.forEach((path, i) => {
    const url = signed[i]
    if (url) urlByPath.set(path, url)
  })

  const overrides = new Map<string, string>()
  for (const [hospId, path] of pathByHospitableId) {
    const url = urlByPath.get(path)
    if (url) overrides.set(hospId, url)
  }
  return overrides
}
