/** Path segments that must never become listing SEO slugs (defense-in-depth). */
export const RESERVED_LISTING_SLUGS: ReadonlySet<string> = new Set([
  'app',
  'login',
  'signup',
  'listings',
  'invite',
  'onboarding',
  'admin',
  'owner',
  'my-home',
  'jobs',
  'portfolio',
  'people',
  'properties',
  'leases',
  'payments',
  'maintenance',
  'dashboard',
  'settings',
  'auth-code-error',
  'receipts',
  'api',
  'vendor',
  'inquiries',
  '_next',
  'property',
  'rent',
  'onboard',
])

export function isReservedListingSlug(slug: string): boolean {
  return RESERVED_LISTING_SLUGS.has(slug.toLowerCase())
}
