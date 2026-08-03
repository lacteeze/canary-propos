/**
 * Shorten a property address for email subjects / compact UI labels.
 * Keeps street + city + province; strips postal, country, and duplicate trailing bits.
 *
 * Examples:
 *   "37 A Gallants St, Paradise, NL A1L 1J2, Canada, Paradise"
 *     → "37 A Gallants St, Paradise, NL"
 *   "37 A Gallants St, Paradise, NL"
 *     → "37 A Gallants St, Paradise, NL"
 */

const COUNTRY_TOKENS = new Set([
  'canada',
  'ca',
  'usa',
  'us',
  'united states',
  'united states of america',
])

const CA_POSTAL_RE = /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d\b/gi
const US_ZIP_RE = /\b\d{5}(?:-\d{4})?\b/g

function stripPostalCodes(segment: string): string {
  return segment.replace(CA_POSTAL_RE, ' ').replace(US_ZIP_RE, ' ').replace(/\s+/g, ' ').trim()
}

function isCountry(segment: string): boolean {
  return COUNTRY_TOKENS.has(segment.trim().toLowerCase())
}

function isPostalOnly(segment: string): boolean {
  const s = segment.trim()
  if (!s) return true
  return (
    /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d$/i.test(s) ||
    /^\d{5}(?:-\d{4})?$/.test(s)
  )
}

/**
 * Compact address for subjects/headings: street, city, province.
 * Falls back to the original trimmed string when parsing yields nothing useful.
 */
export function shortPropertyAddress(address: string | null | undefined): string {
  const raw = (address || '').trim()
  if (!raw) return ''

  const parts = raw
    .split(',')
    .map((p) => stripPostalCodes(p.trim()))
    .filter((p) => p.length > 0 && !isCountry(p) && !isPostalOnly(p))

  const unique: string[] = []
  const seen = new Set<string>()
  for (const part of parts) {
    const key = part.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(part)
  }

  if (unique.length === 0) {
    // Last resort: first comma segment of the original
    return raw.split(',')[0]?.trim() || raw
  }

  // Street + city + province is enough; drop any leftover noise segments.
  return unique.slice(0, 3).join(', ')
}
