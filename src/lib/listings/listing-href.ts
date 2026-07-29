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
