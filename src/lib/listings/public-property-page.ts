/** Unit is long-term leased / occupied. Short-term (`str`) stays publicly bookable. */
export function unitLooksLeased(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase()
  return s === 'leased' || s === 'occupied'
}

/** Public property pages never show lease-end or available-from dates. */
export function propertyAvailabilityLabel(leased: boolean): string {
  return leased ? 'Currently leased' : 'Not currently available'
}

/** Calendar date for published listing details (keeps the year; no timezone shift). */
export function formatListingLeaseEnd(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? new Date(`${dateStr}T12:00:00`)
    : new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Published listings (long-term and mid-term) stay listed on the details page
 * even when the unit is occupied or has an active lease — e.g. available now
 * or available Sep 30. Occupancy / active-lease only applies to unpublished
 * property pages (leased / interest treatment).
 */
export function publishedListingIsListed(status: string | null | undefined): boolean {
  return (status ?? '').trim().toLowerCase() === 'published'
}
