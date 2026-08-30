import type { CanaryInquiry } from './types'

export function shortProperty(address: string): string {
  const street = address.split(',')[0]?.trim() || address
  return street.length > 42 ? `${street.slice(0, 40)}…` : street
}

/** Drop a trailing city segment when it already appears earlier in the address. */
export function cleanPropertyDisplay(address: string): string {
  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length < 2) return address
  const last = parts[parts.length - 1]!
  const earlier = parts.slice(0, -1)
  if (earlier.some((p) => p.toLowerCase() === last.toLowerCase())) {
    return earlier.join(', ')
  }
  return address
}

export type InquiryGroup = {
  key: string
  label: string
  inquiries: CanaryInquiry[]
}

/** Group by linked property when present; otherwise by interest label. */
export function inquiryGroupMeta(inquiry: CanaryInquiry): { key: string; label: string } {
  const raw = inquiry.property.trim()
  const isInterestOnly =
    !inquiry.propertyId &&
    (inquiry.isGeneralInterest || !raw || raw.toLowerCase() === 'general interest')

  if (isInterestOnly) {
    const label = raw && raw.toLowerCase() !== 'general interest' ? raw : 'General interest'
    return { key: `interest:${label.toLowerCase()}`, label }
  }

  const display = shortProperty(cleanPropertyDisplay(raw || 'General interest'))
  if (inquiry.propertyId) {
    return { key: `prop:${inquiry.propertyId}`, label: display }
  }
  return { key: `addr:${display.toLowerCase()}`, label: display }
}

export function groupInquiriesByProperty(inquiries: CanaryInquiry[]): InquiryGroup[] {
  const groups = new Map<string, InquiryGroup>()
  for (const inquiry of inquiries) {
    const { key, label } = inquiryGroupMeta(inquiry)
    const existing = groups.get(key)
    if (existing) {
      existing.inquiries.push(inquiry)
    } else {
      groups.set(key, { key, label, inquiries: [inquiry] })
    }
  }
  return [...groups.values()].sort((a, b) => {
    const byCount = b.inquiries.length - a.inquiries.length
    if (byCount !== 0) return byCount
    return a.label.localeCompare(b.label, 'en', { sensitivity: 'base' })
  })
}

export type ListingInquiryTarget = {
  listingId: string
  propertyId: string | null
  address: string
}

/** Pipeline group key for a published listing (same rules as inquiryGroupMeta). */
export function listingPipelineGroupKey(
  target: Pick<ListingInquiryTarget, 'propertyId' | 'address'>,
): string {
  if (target.propertyId) return `prop:${target.propertyId}`
  const display = shortProperty(cleanPropertyDisplay(target.address || ''))
  return `addr:${display.toLowerCase()}`
}

/** Open pipeline cards for this listing/property (excludes closed). */
export function inquiryMatchesListingGroup(
  inquiry: CanaryInquiry,
  target: ListingInquiryTarget,
): boolean {
  if (inquiry.status === 'closed') return false
  if (target.listingId && inquiry.listingId === target.listingId) return true
  if (target.propertyId && inquiry.propertyId === target.propertyId) return true
  if (!target.propertyId && target.address) {
    return inquiryGroupMeta(inquiry).key === listingPipelineGroupKey(target)
  }
  return false
}

export function countInquiriesForListing(
  inquiries: CanaryInquiry[],
  target: ListingInquiryTarget,
): number {
  let n = 0
  for (const inquiry of inquiries) {
    if (inquiryMatchesListingGroup(inquiry, target)) n += 1
  }
  return n
}
