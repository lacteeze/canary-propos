export function propertyHref(id: string): string {
  return `/app/properties/${id}`
}

export function listingHref(id: string): string {
  return `/app/listings/${id}`
}

/** Staff leasing pipeline, optionally filtered to a property or listing. */
export function leasingPipelineHref(opts?: {
  propertyId?: string | null
  listingId?: string | null
}): string {
  const params = new URLSearchParams()
  params.set('view', 'leases')
  if (opts?.propertyId) params.set('property', opts.propertyId)
  if (opts?.listingId) params.set('listing', opts.listingId)
  return `/app?${params.toString()}`
}

export function personHref(id: string): string {
  return `/app/people/${id}`
}

export function shortAddress(addr: string | null | undefined): string {
  return (addr || '').split(',')[0].trim()
}

export function moneyCad(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return ''
  return '$' + Math.round(n).toLocaleString('en-CA')
}

export function tenantNamesFromInfo(info: string | null | undefined): string {
  if (!info) return ''
  const names = info
    .split(',')
    .map((s) => s.split(':')[0].trim())
    .filter((s) => s && !/@/.test(s) && !/^\d/.test(s))
  return [...new Set(names)].join(', ')
}
