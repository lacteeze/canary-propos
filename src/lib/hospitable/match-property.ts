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

/**
 * Hospitable properties that belong to this org's Canary portfolio
 * (explicit unit.hospitable_property_id link or fuzzy address match).
 * Never return the full Hospitable account when the org has no matching units —
 * that was leaking Canary STR tasks into empty orgs (e.g. Vendor PM).
 */
export function orgScopedHospitableProperties(
  hospitableProperties: HospitableProperty[],
  canaryProperties: CanaryProperty[]
): HospitableProperty[] {
  if (!canaryProperties.length || !hospitableProperties.length) return []
  const byId = buildHospitableAddressMap(canaryProperties)
  return hospitableProperties.filter((hp) => {
    if (byId.has(hp.id)) return true
    if (matchHospitableToCanaryAddress(hp, canaryProperties)) return true
    return Boolean(resolveToCanaryAddress(hospitablePropertyLabel(hp), canaryProperties))
  })
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
    // Only map properties that resolve to this org — never fall back to a raw
    // Hospitable label (that surfaces other tenants' STR inventory).
    if (fuzzy) result.set(hp.id, fuzzy)
  }

  return result
}
