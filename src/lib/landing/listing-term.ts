import { getLandingCopy, type LandingLang } from './content'

export type ListingTermType = 'long' | 'mid'

export const MID_TERM_LEASE = 'Mid-term lease'
export const LONG_TERM_LEASE = 'Long-term lease'

export function leaseHighlightForTermType(termType: ListingTermType): string {
  return termType === 'mid' ? MID_TERM_LEASE : LONG_TERM_LEASE
}

export function deriveTermTypeFromHighlights(
  highlights: string[] | null | undefined
): ListingTermType {
  if (highlights?.some((h) => /mid[- ]term/i.test(h))) return 'mid'
  return 'long'
}

export function termBadgeLabel(
  termType: ListingTermType,
  lang: LandingLang = 'en'
): string {
  const copy = getLandingCopy(lang)
  return termType === 'mid' ? copy.midTerm : copy.longTerm
}
