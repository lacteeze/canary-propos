import type { CanaryProperty } from '@/lib/canary/types'
import type { HospitableProperty } from './client'
import {
  canonicalStreetKey,
  hospitablePropertyLabel,
  normalizeAddressKey,
  resolveToCanaryAddress,
  streetKey,
} from './property-label'

/** Build Hospitable property id → Canary timeline address key from explicit unit links. */
export function buildHospitableAddressMap(canaryProperties: CanaryProperty[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const p of canaryProperties) {
    const id = p.hospitablePropertyId?.trim()
    if (id) map.set(id, p.address)
  }
  return map
}

/** Match a Hospitable property to a Canary property address key via fuzzy address (fallback). */
export function matchHospitableToCanaryAddress(
  hospitable: HospitableProperty,
  canaryProperties: CanaryProperty[]
): string | null {
  const label = hospitablePropertyLabel(hospitable)
  const labelNorm = normalizeAddressKey(label)
  const labelStreet = canonicalStreetKey(label)

  for (const p of canaryProperties) {
    const addrNorm = normalizeAddressKey(p.address)
    if (addrNorm === labelNorm) return p.address
    if (canonicalStreetKey(p.address) === labelStreet) return p.address
    if (streetKey(p.address) === streetKey(label)) return p.address
    const short = p.address.split(',')[0]?.trim() ?? ''
    if (short && normalizeAddressKey(short) === normalizeAddressKey(hospitable.public_name || hospitable.name || '')) {
      return p.address
    }
  }
  return null
}

/** Resolve timeline row address for each Hospitable property (explicit id first, then fuzzy). */
export function resolveHospitablePropertyAddresses(
  hospitableProperties: HospitableProperty[],
  canaryProperties: CanaryProperty[]
): Map<string, string> {
  const byId = buildHospitableAddressMap(canaryProperties)
  const result = new Map<string, string>()

  for (const hp of hospitableProperties) {
    const linked = byId.get(hp.id)
    if (linked) {
      result.set(hp.id, linked)
      continue
    }
    const fuzzy =
      matchHospitableToCanaryAddress(hp, canaryProperties) ??
      resolveToCanaryAddress(hospitablePropertyLabel(hp), canaryProperties)
    result.set(hp.id, fuzzy ?? hospitablePropertyLabel(hp))
  }

  return result
}
