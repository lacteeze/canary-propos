// Shared helpers for property delete/merge server actions.
import { canonicalStreetKey, normalizeAddressKey } from '@/lib/hospitable/property-label'

export type PropertyAddress = { street_address: string; city: string }

export function propertyAddressKey(addr: PropertyAddress): string {
  return `${canonicalStreetKey(addr.street_address)}|${normalizeAddressKey(addr.city)}`
}

export function formatPropertyAddress(addr: PropertyAddress): string {
  return `${addr.street_address}, ${addr.city}`
}

export function addressesMatch(a: PropertyAddress, b: PropertyAddress): boolean {
  return propertyAddressKey(a) === propertyAddressKey(b)
}
