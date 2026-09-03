import { parseListingBrief, type ListingBrief } from '@/lib/listings/listing-brief'
import { resolvePetLabel, resolveUtilitiesLabel } from '@/lib/listings/browse-utils'

export function addressListingTitle(street?: string | null, city?: string | null): string {
  const streetPart = street?.trim() || ''
  const cityPart = city?.trim() || ''
  if (streetPart && cityPart) return `${streetPart}, ${cityPart}`
  return streetPart || cityPart || 'Listing'
}

/** Keep a custom title; default to the address only when creating and no title was entered. */
export function resolveListingTitle(opts: {
  inputTitle?: string | null
  existingTitle?: string | null
  addressTitle: string
  isCreate: boolean
}): string {
  const input = opts.inputTitle?.trim()
  if (input) return input
  const existing = opts.existingTitle?.trim()
  if (existing) return existing
  if (opts.isCreate) return opts.addressTitle
  return opts.addressTitle
}

export function listingDescriptionOnly(description?: string | null): string | null {
  const text = description?.trim()
  return text || null
}

export function mergeListingBriefPatch(
  raw: unknown,
  patch: { pets?: string | null; utilities?: string | null; parking?: string | null },
): ListingBrief {
  const brief = parseListingBrief(raw)
  if (patch.pets != null) brief.pets = patch.pets.trim()
  if (patch.utilities != null) brief.utilities = normalizeUtilitiesBrief(patch.utilities)
  if (patch.parking != null) brief.parking = patch.parking.trim()
  return brief
}

function normalizeUtilitiesBrief(value: string): string {
  const trimmed = value.trim()
  if (/^included$/i.test(trimmed) || /^utilities included$/i.test(trimmed)) {
    return 'Utilities included'
  }
  if (/^not included$/i.test(trimmed) || /^pou$/i.test(trimmed)) {
    return 'Tenant pays utilities'
  }
  return trimmed
}

export function staffPetsLabel(
  briefPets: string | null | undefined,
  amenities: string[] | null,
  description: string | null,
): string {
  return resolvePetLabel({ briefPets, amenities, description }) ?? 'No pets'
}

export function staffUtilitiesLabel(
  briefUtilities: string | null | undefined,
  description: string | null,
  amenities?: string[] | null,
): string {
  const resolved = resolveUtilitiesLabel({ briefUtilities, description, amenities })
  if (resolved === 'Utilities included') return 'Included'
  if (resolved === 'POU') return 'Not included'
  return briefUtilities?.trim() || 'Not included'
}
