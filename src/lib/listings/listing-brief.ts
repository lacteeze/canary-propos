import { z } from 'zod'

const featureTagSchema = z.string().trim().min(1).max(120)

/** Coerce legacy comma-separated `features` strings into string[]. */
function coerceFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean)
      .slice(0, 40)
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 40)
  }
  return []
}

/** Structured quick fields for AI listing descriptions (stored on properties.listing_brief). */
export const listingBriefSchema = z.object({
  pets: z.string().trim().max(200).optional().default(''),
  utilities: z.string().trim().max(300).optional().default(''),
  parking: z.string().trim().max(200).optional().default(''),
  laundry: z.string().trim().max(200).optional().default(''),
  furnished: z.string().trim().max(120).optional().default(''),
  neighborhood: z.string().trim().max(500).optional().default(''),
  /** Standout feature tags (multi-select). Legacy comma-separated strings are coerced in parseListingBrief. */
  features: z.array(featureTagSchema).max(40).optional().default([]),
})

export type ListingBrief = z.infer<typeof listingBriefSchema>
export type ListingBriefField = keyof ListingBrief
export type ListingBriefScalarField = Exclude<ListingBriefField, 'features'>

export const LISTING_BRIEF_FIELD_KEYS = [
  'pets',
  'utilities',
  'parking',
  'laundry',
  'furnished',
  'neighborhood',
  'features',
] as const satisfies readonly ListingBriefField[]

export const LISTING_BRIEF_SCALAR_KEYS = [
  'pets',
  'utilities',
  'parking',
  'laundry',
  'furnished',
  'neighborhood',
] as const satisfies readonly ListingBriefScalarField[]

/** Seed defaults for quick-field dropdowns (org-learned values append on top). */
export const DEFAULT_LISTING_BRIEF_OPTIONS: Record<ListingBriefField, string[]> = {
  pets: [
    'No pets',
    'Cats OK',
    'Dogs OK',
    'Pets OK',
    'Pets by approval',
    // Legacy amenity labels (still synced from unit.amenities)
    'Pet friendly',
    'Cat friendly',
    'Dog friendly',
    'By approval',
  ],
  utilities: [
    'Utilities included',
    'Tenant pays utilities',
    'Heat included',
    'Heat & hot water included',
    'Electricity included',
  ],
  parking: [
    'No parking',
    '1 driveway spot',
    '1 garage',
    'Street parking',
    'Assigned parking',
  ],
  laundry: [
    'In-unit washer/dryer',
    'Shared laundry',
    'Laundry in building',
    'Hookups only',
    'No laundry',
  ],
  furnished: ['Unfurnished', 'Furnished', 'Partially furnished'],
  neighborhood: [
    'Quiet residential street',
    'Near downtown',
    'Near university',
    'Near bus route',
    'Walkable to shops',
  ],
  features: [
    'Hardwood floors',
    'South-facing',
    'Updated kitchen',
    'Private entrance',
    'Yard access',
  ],
}

const listingBriefOptionsSchema = z.record(z.string(), z.array(z.string()))

export type ListingBriefOptions = Record<ListingBriefField, string[]>

export function emptyListingBrief(): ListingBrief {
  return {
    pets: '',
    utilities: '',
    parking: '',
    laundry: '',
    furnished: '',
    neighborhood: '',
    features: [],
  }
}

export function parseListingBrief(raw: unknown): ListingBrief {
  const base = emptyListingBrief()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base

  const obj = raw as Record<string, unknown>
  const parsed = listingBriefSchema.safeParse({
    ...obj,
    features: coerceFeatures(obj.features),
  })
  if (parsed.success) return parsed.data
  return {
    ...base,
    features: coerceFeatures(obj.features),
  }
}

/** Merge seeded defaults with org-learned custom values (case-insensitive dedupe). */
export function mergeListingBriefOptions(raw: unknown): ListingBriefOptions {
  const parsed = listingBriefOptionsSchema.safeParse(raw ?? {})
  const learned = parsed.success ? parsed.data : {}
  const out = {} as ListingBriefOptions
  for (const key of LISTING_BRIEF_FIELD_KEYS) {
    const base = DEFAULT_LISTING_BRIEF_OPTIONS[key]
    const extras = (learned[key] ?? [])
      .map((v) => v.trim())
      .filter(Boolean)
    const seen = new Set(base.map((v) => v.toLowerCase()))
    const merged = [...base]
    for (const v of extras) {
      const k = v.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      merged.push(v)
    }
    out[key] = merged
  }
  return out
}

/** Learned (non-seed) option values stored for an org field. */
export function getLearnedListingBriefOptions(
  raw: unknown,
  field: ListingBriefField
): string[] {
  const parsed = listingBriefOptionsSchema.safeParse(raw ?? {})
  if (!parsed.success) return []
  const defaults = new Set(DEFAULT_LISTING_BRIEF_OPTIONS[field].map((v) => v.toLowerCase()))
  return (parsed.data[field] ?? [])
    .map((v) => v.trim())
    .filter((v) => v && !defaults.has(v.toLowerCase()))
}

/** Collect values from a brief that are not already in the merged option lists. */
export function collectNewListingBriefOptions(
  brief: ListingBrief,
  current: ListingBriefOptions
): Partial<Record<ListingBriefField, string[]>> {
  const additions: Partial<Record<ListingBriefField, string[]>> = {}

  for (const key of LISTING_BRIEF_SCALAR_KEYS) {
    const value = brief[key]?.trim()
    if (!value) continue
    const exists = current[key].some((o) => o.toLowerCase() === value.toLowerCase())
    if (!exists) {
      additions[key] = [value]
    }
  }

  const novelFeatures: string[] = []
  const seen = new Set<string>()
  for (const value of brief.features) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const k = trimmed.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    const exists = current.features.some((o) => o.toLowerCase() === k)
    if (!exists) novelFeatures.push(trimmed)
  }
  if (novelFeatures.length) additions.features = novelFeatures

  return additions
}

/** Persist shape: defaults are not stored; only learned custom values. */
export function appendLearnedListingBriefOptions(
  existingRaw: unknown,
  additions: Partial<Record<ListingBriefField, string[]>>
): Record<string, string[]> {
  const parsed = listingBriefOptionsSchema.safeParse(existingRaw ?? {})
  const next: Record<string, string[]> = parsed.success ? { ...parsed.data } : {}
  for (const key of LISTING_BRIEF_FIELD_KEYS) {
    const add = additions[key]
    if (!add?.length) continue
    const list = [...(next[key] ?? [])]
    const seen = new Set(list.map((v) => v.toLowerCase()))
    // Also skip values that are already defaults
    for (const d of DEFAULT_LISTING_BRIEF_OPTIONS[key]) seen.add(d.toLowerCase())
    for (const v of add) {
      const trimmed = v.trim()
      if (!trimmed) continue
      const k = trimmed.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      list.push(trimmed)
    }
    if (list.length) next[key] = list
  }
  return next
}

/**
 * Remove a custom-learned option from org storage.
 * Seed defaults are never stored and cannot be removed this way.
 */
export function removeLearnedListingBriefOption(
  existingRaw: unknown,
  field: ListingBriefField,
  value: string
): Record<string, string[]> {
  const parsed = listingBriefOptionsSchema.safeParse(existingRaw ?? {})
  const next: Record<string, string[]> = parsed.success ? { ...parsed.data } : {}
  const trimmed = value.trim()
  if (!trimmed) return next
  const list = (next[field] ?? []).filter((v) => v.toLowerCase() !== trimmed.toLowerCase())
  if (list.length) next[field] = list
  else delete next[field]
  return next
}

export function isDefaultListingBriefOption(field: ListingBriefField, value: string): boolean {
  const k = value.trim().toLowerCase()
  return DEFAULT_LISTING_BRIEF_OPTIONS[field].some((d) => d.toLowerCase() === k)
}

export function listingBriefToPromptLines(brief: ListingBrief): string[] {
  const featureLine = brief.features.map((f) => f.trim()).filter(Boolean).join(', ')
  const rows: [string, string][] = [
    ['Pets', brief.pets],
    ['Utilities', brief.utilities],
    ['Parking', brief.parking],
    ['Laundry', brief.laundry],
    ['Furnished', brief.furnished],
    ['Neighborhood', brief.neighborhood],
    ['Standout features', featureLine],
  ]
  return rows.filter(([, v]) => v.trim()).map(([k, v]) => `${k}: ${v.trim()}`)
}

const PET_AMENITY_RE = /pet|cat|dog|approval/i

/** Derive a pets label from unit amenities (legacy storage used by public cards). */
export function petsLabelFromAmenities(amenities: string[] | null | undefined): string {
  const pet = (amenities ?? []).find((a) => PET_AMENITY_RE.test(a))
  return pet?.trim() || ''
}

/**
 * Rewrite unit amenities so pets come from listing_brief.pets (single source of truth).
 * "No pets" / empty clears pet amenity tags; other values become the pet amenity string.
 */
export function syncPetsIntoAmenities(
  amenities: string[] | null | undefined,
  pets: string
): string[] {
  const nonPet = (amenities ?? []).filter((a) => !PET_AMENITY_RE.test(a))
  const trimmed = pets.trim()
  if (!trimmed || /^no pets$/i.test(trimmed)) return nonPet
  return [...nonPet, trimmed]
}
