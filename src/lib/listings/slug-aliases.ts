/**
 * Street-type tokens people mix in public URLs and search
 * (`rd` vs `road`, `st` vs `street`). Only the last street-type segment is
 * aliased so names like St. John's are left alone.
 */
const STREET_SUFFIX_GROUPS: readonly (readonly string[])[] = [
  ['rd', 'road'],
  ['st', 'street'],
  ['ave', 'avenue', 'av'],
  ['dr', 'drive'],
  ['blvd', 'boulevard'],
  ['ln', 'lane'],
  ['ct', 'court', 'crt'],
  ['pl', 'place'],
  ['cir', 'circle'],
  ['ter', 'terrace'],
  ['hwy', 'highway'],
  ['pkwy', 'parkway'],
  ['cres', 'crescent'],
  ['sq', 'square'],
]

function suffixGroupFor(token: string): readonly string[] | null {
  return STREET_SUFFIX_GROUPS.find((group) => group.includes(token)) ?? null
}

/** Alternate slugs for the last street-type token (`rd` ↔ `road`). Collision suffixes like `-2` are kept. */
export function streetSuffixSlugAliases(slug: string): string[] {
  const parts = slug.trim().toLowerCase().split('-').filter(Boolean)
  if (parts.length < 2) return []

  let numericSuffix: string | null = null
  let tokens = parts
  const last = parts[parts.length - 1]
  if (last && /^\d+$/.test(last)) {
    numericSuffix = last
    tokens = parts.slice(0, -1)
  }
  if (tokens.length < 2) return []

  const streetToken = tokens[tokens.length - 1]
  if (!streetToken) return []
  const group = suffixGroupFor(streetToken)
  if (!group) return []

  return group
    .filter((alt) => alt !== streetToken)
    .map((alt) => {
      const next = [...tokens.slice(0, -1), alt]
      if (numericSuffix) next.push(numericSuffix)
      return next.join('-')
    })
}

/** Exact slug first, then street-suffix aliases. */
export function publicSlugLookupCandidates(slug: string): string[] {
  const normalized = slug.trim().toLowerCase()
  if (!normalized) return []
  const seen = new Set<string>([normalized])
  const out = [normalized]
  for (const alias of streetSuffixSlugAliases(normalized)) {
    if (seen.has(alias)) continue
    seen.add(alias)
    out.push(alias)
  }
  return out
}

/** Path segment from a pasted canarypm.ca URL, or a kebab slug typed as-is. */
export function publicSlugFromSearchText(text: string): string | null {
  const t = text.trim()
  if (!t) return null

  const asUrl =
    /^https?:\/\//i.test(t)
      ? t
      : /^(?:www\.)?canarypm\.ca\//i.test(t)
        ? `https://${t}`
        : null
  if (asUrl) {
    try {
      const part = new URL(asUrl).pathname.split('/').filter(Boolean)[0]
      return part ? part.toLowerCase() : null
    } catch {
      return null
    }
  }

  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(t)) return t.toLowerCase()
  return null
}

function haystackMatchesSlugCandidate(haystack: string, candidate: string): boolean {
  const words = candidate.replace(/-/g, ' ')
  const dashed = haystack.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return haystack.toLowerCase().includes(words) || dashed.includes(candidate)
}

/** True when a browse/search query matches this listing’s address, slug, or rd/road URL variant. */
export function listingMatchesAddressQuery(
  query: string,
  listing: {
    href: string
    shortAddress: string
    city: string
    province?: string | null
  },
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const haystack = `${listing.shortAddress} ${listing.city} ${listing.province ?? ''}`
  if (haystack.toLowerCase().includes(q)) return true

  const slugFromQuery =
    publicSlugFromSearchText(q) ??
    q.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!slugFromQuery) return false

  const hrefSlug = listing.href.replace(/^\//, '').split(/[/?#]/)[0] ?? ''
  const hrefCandidates = new Set(publicSlugLookupCandidates(hrefSlug))
  const queryCandidates = publicSlugLookupCandidates(slugFromQuery)

  return queryCandidates.some(
    (candidate) =>
      hrefCandidates.has(candidate) || haystackMatchesSlugCandidate(haystack, candidate),
  )
}
