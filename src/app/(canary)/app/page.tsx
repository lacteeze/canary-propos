// src/app/(canary)/app/page.tsx
// The CanaryApp backend portal — server-side auth guard + data load,
// rendered by the CanaryApp client component.
import { redirect } from 'next/navigation'
import CanaryApp from '@/components/canary/CanaryApp'
import { getCaller, loadCanaryDb } from '@/lib/canary/load-db'
import { loadHospitableCalendar } from '@/lib/canary/load-hospitable-calendar'
import { loadHospitableTasks } from '@/lib/canary/load-hospitable-tasks'
import { fetchAllProperties, isHospitableConfigured } from '@/lib/hospitable/client'
import type { CanaryRole } from '@/lib/canary/types'

export const dynamic = 'force-dynamic'

function toCanaryRole(roles: string[]): CanaryRole {
  if (roles.includes('admin')) return 'Admin'
  if (roles.includes('manager') || roles.includes('employee')) return 'Manager'
  if (roles.includes('owner')) return 'Owner'
  if (roles.includes('tenant')) return 'Tenant'
  if (roles.includes('vendor')) return 'Vendor'
  return 'Tenant'
}

export default async function CanaryAppPage() {
  const caller = await getCaller()
  if (caller === 'no-user') redirect('/login')
  // Signed in but no people row yet — finish workspace setup first
  if (caller === 'no-person') redirect('/onboarding')

  const db = await loadCanaryDb(caller.orgId)

  // One properties fetch shared by calendar + tasks loaders
  let hospitableProperties: Awaited<ReturnType<typeof fetchAllProperties>> | undefined
  if (isHospitableConfigured()) {
    try {
      hospitableProperties = await fetchAllProperties()
    } catch (error) {
      console.error('[CanaryAppPage] Hospitable properties fetch failed', error)
    }
  }

  const hospitableCalendar = await loadHospitableCalendar(db.properties, hospitableProperties)
  const hospitableTasks = await loadHospitableTasks(
    db.properties,
    hospitableCalendar.strBookings,
    hospitableProperties
  )
  const role = toCanaryRole(caller.roles)
  const canSwitchRoles = role === 'Admin' || role === 'Manager'

  return (
    <CanaryApp
      db={db}
      hospitableCalendar={hospitableCalendar}
      hospitableTasks={hospitableTasks}
      userRole={role}
      userPersonId={caller.personId}
      canSwitchRoles={canSwitchRoles}
      userName={caller.name}
    />
  )
}
