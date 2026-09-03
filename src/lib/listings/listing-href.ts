import { brandFromOrg } from '@/lib/brand'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isListingUuid(idOrSlug: string): boolean {
  return UUID_RE.test(idOrSlug)
}

export function listingPublicHref(
  listing: { id: string; slug?: string | null },
  orgQuery: string,
): string {
  if (listing.slug) {
    return `/${listing.slug}${orgQuery}`
  }
  return `/listings/${listing.id}${orgQuery}`
}

/** Stable public property URL (`/{slug}` or absolute canarypm.ca when requested). */
export function propertyPublicHref(
  property: { slug?: string | null },
  opts?: { orgQuery?: string; absolute?: boolean; orgSlug?: string },
): string | null {
  if (!property.slug) return null
  const orgQuery = opts?.orgQuery ?? ''
  const path = `/${property.slug}${orgQuery}`
  if (opts?.absolute) {
    return `${brandFromOrg({ slug: opts.orgSlug ?? 'canary' }).publicBaseUrl}${path}`
  }
  return path
}
