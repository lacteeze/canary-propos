// Role → portal landing path. Tenants use the dedicated /my-home shell;
// staff/owners/vendors land in CanaryApp (vendors scoped to Projects).
//
// Tenant viewer model (MVP): no share/viewer table. Scope is
// leases.tenant_id → people.id (plus payments via lease_id, work orders
// created by the tenant or on their active lease unit/property).
// Manager "Invite to portal" emails people with role tenant.

export const ROLE_REDIRECT: Record<string, string> = {
  manager: '/app',
  employee: '/app',
  admin: '/app',
  tenant: '/my-home',
  owner: '/app',
  vendor: '/app?view=projects',
}

/** Normalize people.role (string | string[]) or JWT claim to a primary role string. */
export function primaryRoleFromClaim(
  role: string | string[] | null | undefined,
): string | undefined {
  if (!role) return undefined
  if (Array.isArray(role)) {
    if (role.includes('admin')) return 'admin'
    if (role.includes('manager')) return 'manager'
    if (role.includes('employee')) return 'employee'
    if (role.includes('owner')) return 'owner'
    if (role.includes('tenant')) return 'tenant'
    if (role.includes('vendor')) return 'vendor'
    return role[0]
  }
  return role
}

export function portalPathForRole(
  role: string | string[] | null | undefined,
): string {
  const primary = primaryRoleFromClaim(role)
  if (!primary) return '/app'
  return ROLE_REDIRECT[primary] ?? '/app'
}
