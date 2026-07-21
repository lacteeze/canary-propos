// Shared helpers for property delete/merge server actions.
import { canonicalStreetKey, normalizeAddressKey } from '@/lib/hospitable/property-label'

export type PropertyAddress = { street_address: string; city: string }

export function propertyAddressKey(addr: PropertyAddress): string {
  return `${canonicalStreetKey(addr.street_address)}|${normalizeAddressKey(addr.city)}`
}

export function formatPropertyAddress(addr: PropertyAddress): string {
  return `${addr.street_address}, ${addr.city}`
}

/** Street-only label — drops city/province/postal after the first comma. */
export function shortStreetAddress(streetAddress: string | null | undefined): string {
  if (!streetAddress) return ''
  const trimmed = streetAddress.trim()
  if (!trimmed) return ''
  return trimmed.split(',')[0]?.trim() || trimmed
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
    cityTrim && !street.toLowerCase().includes(cityTrim.toLowerCase())
      ? `${street}, ${cityTrim}`
      : street
  const unit = unitNumber?.trim()
  return unit ? `${base} · ${unit}` : base
}

export function addressesMatch(a: PropertyAddress, b: PropertyAddress): boolean {
  return propertyAddressKey(a) === propertyAddressKey(b)
}
