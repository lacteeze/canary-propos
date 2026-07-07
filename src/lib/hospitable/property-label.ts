import type { HospitableProperty } from './client'

/** Display address / label for a Hospitable property (timeline row key). */
export function hospitablePropertyLabel(property: HospitableProperty): string {
  const display = property.address?.display?.trim()
  if (display) {
    if (display.includes(',')) return display
    const city = property.address?.city?.trim()
    return city ? `${display}, ${city}` : display
  }
  const name = (property.public_name || property.name || 'STR property').trim()
  const city = property.address?.city?.trim()
  return city ? `${name}, ${city}` : name
}

export function normalizeAddressKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function streetKey(value: string): string {
  const first = value.split(',')[0]?.trim() ?? value
  return normalizeAddressKey(first)
}

/** Normalized street token with common suffix abbreviations collapsed (rd/road, st/street, …). */
const STREET_SUFFIX_ALIASES: Record<string, string> = {
  road: 'rd',
  rd: 'rd',
  street: 'st',
  st: 'st',
  avenue: 'ave',
  ave: 'ave',
  drive: 'dr',
  dr: 'dr',
  lane: 'ln',
  ln: 'ln',
  court: 'ct',
  ct: 'ct',
  boulevard: 'blvd',
  blvd: 'blvd',
  crescent: 'cres',
  cres: 'cres',
  place: 'pl',
  pl: 'pl',
}

function canonicalizeStreetTokens(tokens: string[]): string[] {
  if (!tokens.length) return tokens
  const last = tokens[tokens.length - 1]
  const alias = STREET_SUFFIX_ALIASES[last]
  if (alias) tokens[tokens.length - 1] = alias
  return tokens
}

export function canonicalStreetKey(value: string): string {
  const normalized = streetKey(value)
  if (!normalized) return normalized
  return canonicalizeStreetTokens(normalized.split(' ')).join(' ')
}

/** Resolve a lease/draft/STR address key to the matching Canary property address, if any. */
export function resolveToCanaryAddress(
  address: string,
  canaryProperties: Array<{ address: string }>
): string | null {
  const exact = canaryProperties.find((p) => p.address === address)
  if (exact) return exact.address

  const key = canonicalStreetKey(address)
  const cityKey = normalizeAddressKey(address.split(',')[1] ?? '')

  for (const p of canaryProperties) {
    if (canonicalStreetKey(p.address) !== key) continue
    const pCity = normalizeAddressKey(p.address.split(',')[1] ?? '')
    if (!cityKey || !pCity || cityKey === pCity) return p.address
  }
  return null
}
