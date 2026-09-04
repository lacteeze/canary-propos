import { primaryRoleFromClaim } from '@/lib/auth/role-redirect'
import { listingHref, propertyHref } from '@/lib/canary/entity-href'

/** Staff who can edit listings in the app — not tenants, owners, or vendors. */
export function canSeePublicListingEdit(
  role: string | string[] | null | undefined,
  userOrgId?: string | null,
  listingOrgId?: string | null,
): boolean {
  const primary = primaryRoleFromClaim(role)
  if (primary !== 'admin' && primary !== 'manager') return false
  if (listingOrgId && userOrgId && userOrgId !== listingOrgId) return false
  return true
}

export function staffListingEditHref(listingId: string): string {
  return listingHref(listingId)
}

export function staffPropertyEditHref(propertyId: string): string {
  return propertyHref(propertyId)
}
