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

/**
 * True when `city` already appears as its own comma-separated segment after the
 * street line (case-insensitive). Does not treat city substrings inside the
 * street name (e.g. "Paradise Lane") as a match.
 */
export function streetAddressHasCitySegment(
  streetAddress: string,
  city: string,
): boolean {
  const cityKey = city.trim().toLowerCase()
  if (!cityKey) return false
  const parts = streetAddress
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
  // First segment is the street line; only later location segments count.
  return parts.slice(1).some((part) => part === cityKey)
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
  const base =
    cityTrim && !streetAddressHasCitySegment(street, cityTrim)
      ? `${street}, ${cityTrim}`
      : street
  const unit = unitNumber?.trim()
  return unit ? `${base} · ${unit}` : base
}

export function addressesMatch(a: PropertyAddress, b: PropertyAddress): boolean {
  return propertyAddressKey(a) === propertyAddressKey(b)
}
