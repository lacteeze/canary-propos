// Shared helpers for property delete/merge server actions.
import { canonicalStreetKey, normalizeAddressKey } from '@/lib/hospitable/property-label'

export type PropertyAddress = { street_address: string; city: string }

export function propertyAddressKey(addr: PropertyAddress): string {
  return `${canonicalStreetKey(addr.street_address)}|${normalizeAddressKey(addr.city)}`
}

export function formatPropertyAddress(addr: PropertyAddress): string {
  return formatPropertyFullLabel(addr.street_address, addr.city) ?? addr.street_address
}

/** Street-only label — drops city/province/postal after the first comma. */
export function shortStreetAddress(streetAddress: string | null | undefined): string {
  if (!streetAddress) return ''
  const trimmed = streetAddress.trim()
  if (!trimmed) return ''
  return trimmed.split(',')[0]?.trim() || trimmed
}

/** Punctuation/case-insensitive city key — "St. John's" ≡ "St Johns". */
function citySegmentKey(value: string): string {
  // Strip apostrophes first so John's → johns (not "john s").
  return value
    .toLowerCase()
    .replace(/[''`´’]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * True when `city` already appears as its own comma-separated segment after the
 * street line (case/punctuation-insensitive). Does not treat city substrings
 * inside the street name (e.g. "Paradise Lane") as a match.
 */
export function streetAddressHasCitySegment(
  streetAddress: string,
  city: string,
): boolean {
  const cityKey = citySegmentKey(city)
  if (!cityKey) return false
  const parts = streetAddress
    .split(',')
    .map((part) => citySegmentKey(part))
    .filter(Boolean)
  // First segment is the street line; only later location segments count.
  return parts.slice(1).some((part) => part === cityKey)
}

/**
 * Display-only: drop a trailing `, {city}` when that city already appears earlier
 * as a location segment (fixes stored Google lines that were double-appended).
 */
export function stripTrailingDuplicateCity(
  streetAddress: string,
  city: string,
): string {
  const cityKey = citySegmentKey(city)
  if (!cityKey) return streetAddress.trim()
  const parts = streetAddress
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  while (parts.length > 1) {
    const lastKey = citySegmentKey(parts[parts.length - 1]!)
    if (lastKey !== cityKey) break
    const earlierHasCity = parts
      .slice(1, -1)
      .some((part) => citySegmentKey(part) === cityKey)
    if (!earlierHasCity) break
    parts.pop()
  }
  return parts.join(', ')
}

/**
 * Compact property chip label: street (+ optional unit), e.g. "12 Pennywell Rd" or
 * "12 Pennywell Rd · 10A".
 */
export function formatPropertyChipLabel(
  streetAddress: string | null | undefined,
  unitNumber?: string | null,
): string | null {
  const street = shortStreetAddress(streetAddress)
  if (!street) return null
  const unit = unitNumber?.trim()
  return unit ? `${street} · ${unit}` : street
}

/** Fuller address for tooltips / search — keeps stored street + city (+ unit). */
export function formatPropertyFullLabel(
  streetAddress: string | null | undefined,
  city?: string | null,
  unitNumber?: string | null,
): string | null {
  const street = streetAddress?.trim()
  if (!street) return null
  const cityTrim = city?.trim()
  const cleaned = cityTrim ? stripTrailingDuplicateCity(street, cityTrim) : street
  const base =
    cityTrim && !streetAddressHasCitySegment(cleaned, cityTrim)
      ? `${cleaned}, ${cityTrim}`
      : cleaned
  const unit = unitNumber?.trim()
  return unit ? `${base} · ${unit}` : base
}

export function addressesMatch(a: PropertyAddress, b: PropertyAddress): boolean {
  return propertyAddressKey(a) === propertyAddressKey(b)
}

/**
 * Default unit inserted with a new property. The staff properties list is
 * loaded from `units`, so a property with no unit never appears.
 */
export function defaultNewPropertyUnit(
  orgId: string,
  propertyId: string,
  unitNumber?: string | null,
) {
  const trimmed = unitNumber?.trim() || null
  return {
    org_id: orgId,
    property_id: propertyId,
    unit_number: trimmed,
    bedrooms: 1,
    bathrooms: 1,
    status: 'vacant' as const,
  }
}

/**
 * Newest properties first so staff can fill in listings/leases right after add.
 * Missing timestamps sort last.
 */
export function sortPropertiesNewestFirst<T extends { createdAt?: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const bt = Date.parse(b.createdAt || '') || 0
    const at = Date.parse(a.createdAt || '') || 0
    return bt - at
  })
}
