/** Unit is long-term leased / occupied. Short-term (`str`) stays publicly bookable. */
export function unitLooksLeased(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase()
  return s === 'leased' || s === 'occupied'
}

/** Public property pages never show lease-end or available-from dates. */
export function propertyAvailabilityLabel(leased: boolean): string {
  return leased ? 'Currently leased' : 'Not currently available'
}
