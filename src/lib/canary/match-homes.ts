// Score candidate homes for leftover-lead recycling (beds/baths/city/rent).

export type MatchHomeCriteria = {
  propertyId: string | null
  city: string | null
  bedrooms: number | null
  bathrooms: number | null
  rent: number | null
}

export type MatchHomeCandidate = {
  propertyId: string
  listingId: string | null
  address: string
  city: string
  beds: number | null
  baths: number | null
  rent: number | null
  availableFrom: string | null
  status: string
  href: string
  slug: string | null
}

export type ScoredMatchHome = MatchHomeCandidate & { score: number }

function normalizeCity(city: string | null | undefined): string {
  return (city ?? '').trim().toLowerCase()
}

/** Higher is better. Returns null when the candidate should be excluded. */
export function scoreHomeMatch(
  criteria: MatchHomeCriteria,
  candidate: MatchHomeCandidate,
): number | null {
  if (criteria.propertyId && candidate.propertyId === criteria.propertyId) {
    return null
  }

  let score = 0

  const cCity = normalizeCity(criteria.city)
  const aCity = normalizeCity(candidate.city)
  if (cCity && aCity) {
    if (cCity === aCity) score += 40
    else if (cCity.includes(aCity) || aCity.includes(cCity)) score += 20
    else score -= 15
  }

  if (criteria.bedrooms != null && candidate.beds != null) {
    const bedDelta = Math.abs(criteria.bedrooms - candidate.beds)
    if (bedDelta === 0) score += 35
    else if (bedDelta === 1) score += 12
    else return null
  }

  if (criteria.bathrooms != null && candidate.baths != null) {
    const bathDelta = Math.abs(criteria.bathrooms - candidate.baths)
    if (bathDelta === 0) score += 15
    else if (bathDelta <= 0.5) score += 8
    else if (bathDelta <= 1) score += 2
  }

  if (criteria.rent != null && criteria.rent > 0 && candidate.rent != null && candidate.rent > 0) {
    const ratio = candidate.rent / criteria.rent
    if (ratio >= 0.8 && ratio <= 1.2) score += 25
    else if (ratio >= 0.7 && ratio <= 1.3) score += 10
    else score -= 10
  }

  const status = candidate.status.toLowerCase()
  if (status.includes('listed') || status.includes('published')) score += 18
  else if (status.includes('vacant')) score += 14
  else if (status.includes('available') || status.includes('soon')) score += 12
  else if (status === 'str') score += 8

  if (candidate.availableFrom) score += 4

  return score
}

export function rankMatchingHomes(
  criteria: MatchHomeCriteria,
  candidates: MatchHomeCandidate[],
  limit = 8,
): ScoredMatchHome[] {
  const scored: ScoredMatchHome[] = []
  for (const candidate of candidates) {
    const score = scoreHomeMatch(criteria, candidate)
    if (score == null || score < 20) continue
    scored.push({ ...candidate, score })
  }
  scored.sort((a, b) => b.score - a.score || (a.rent ?? 0) - (b.rent ?? 0))
  return scored.slice(0, limit)
}

/** Ensure visitor note is tagged as general interest and records source address. */
export function ensureGeneralInterestNote(
  existingNote: string | null | undefined,
  sourceAddress: string,
): string {
  const trimmed = (existingNote ?? '').trim()
  const hasPrefix = trimmed.startsWith('[General interest]')
  const lines: string[] = []
  if (hasPrefix) {
    lines.push(...trimmed.split('\n'))
  } else {
    lines.push('[General interest]')
    if (trimmed) {
      lines.push('')
      lines.push(trimmed)
    }
  }
  const sourceLine = `Converted from: ${sourceAddress}`
  if (!lines.some((l) => l.toLowerCase().includes('converted from:'))) {
    // Insert after the prefix line
    lines.splice(1, 0, sourceLine)
  }
  return lines.join('\n').trim()
}
