import { notFound, redirect } from 'next/navigation'
import { getCaller, loadCanaryDb } from '@/lib/canary/load-db'
import type { CanaryDb, CanaryRole } from '@/lib/canary/types'

export function toCanaryRole(roles: string[]): CanaryRole {
  if (roles.includes('admin')) return 'Admin'
  if (roles.includes('manager') || roles.includes('employee')) return 'Manager'
  if (roles.includes('owner')) return 'Owner'
  if (roles.includes('tenant')) return 'Tenant'
  if (roles.includes('vendor')) return 'Vendor'
  return 'Tenant'
}

export function isStaffRoles(roles: string[]): boolean {
  return roles.some((r) => ['admin', 'manager', 'employee'].includes(r))
}

export type CanaryEntityContext = {
  db: CanaryDb
  role: CanaryRole
  personId: string
  canEdit: boolean
  priv: boolean
}

function scopeDb(db: CanaryDb, role: CanaryRole, personId: string): CanaryDb {
  if (role === 'Admin' || role === 'Manager') return db

  let { properties, leases, portfolios, projects, people } = db
  let drafts = db.drafts

  if (role === 'Owner') {
    const pf = portfolios.filter((x) => (x.ownerIds || '').includes(personId))
    const pfIds = new Set(pf.map((x) => x.id))
    properties = properties.filter((p) => pfIds.has(p.portfolioId) || p.ownerId === personId)
    const addrs = new Set(properties.map((p) => p.address))
    leases = leases.filter((l) => addrs.has(l.property))
    projects = projects.filter((j) => addrs.has(j.property))
    portfolios = pf
    people = people.filter((x) => x.id === personId)
    drafts = drafts.filter((d) => properties.some((p) => p.id === d.propId || p.id === d.unitId))
  } else if (role === 'Vendor') {
    const me = db.people.find((x) => x.id === personId)
    const nm = me ? me.name : '§none§'
    projects = projects.filter(
      (j) =>
        j.assignedVendorId === personId ||
        (!j.assignedVendorId && nm !== '§none§' && (j.contractors || '').includes(nm)),
    )
    const addrs = new Set(projects.map((j) => j.property))
    properties = properties.filter((p) => addrs.has(p.address))
    leases = []
    portfolios = []
    people = []
    drafts = []
  } else {
    leases = leases.filter((l) => (l.tenantIds || '').includes(personId))
    const addrs = new Set(leases.map((l) => l.property))
    properties = properties.filter((p) => addrs.has(p.address))
    projects = projects.filter((j) => addrs.has(j.property))
    portfolios = []
    people = []
    drafts = []
  }

  return { ...db, properties, leases, portfolios, projects, people, drafts }
}

export async function loadCanaryEntityContext(): Promise<CanaryEntityContext> {
  const caller = await getCaller()
  if (caller === 'no-user') redirect('/login')
  if (caller === 'no-person') redirect('/onboarding')

  const isTenantOnly =
    caller.roles.includes('tenant') && !isStaffRoles(caller.roles)
  if (isTenantOnly) redirect('/my-home')

  const isVendorOnly =
    caller.roles.includes('vendor') && !isStaffRoles(caller.roles)
  const db = await loadCanaryDb(caller.orgId, {
    redactForVendor: isVendorOnly,
    vendorPersonId: isVendorOnly ? caller.personId : undefined,
  })
  const role = toCanaryRole(caller.roles)
  const scoped = scopeDb(db, role, caller.personId)
  const priv = role === 'Admin' || role === 'Manager'

  return {
    db: scoped,
    role,
    personId: caller.personId,
    canEdit: priv,
    priv,
  }
}

export function requireEntity<T>(entity: T | undefined | null): T {
  if (!entity) notFound()
  return entity
}
