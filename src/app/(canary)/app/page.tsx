// src/app/(canary)/app/page.tsx
// The CanaryApp backend portal — server-side auth guard + data load,
// rendered by the CanaryApp client component.
import { redirect } from 'next/navigation'
import CanaryApp from '@/components/canary/CanaryApp'
import { getCaller, loadCanaryDb } from '@/lib/canary/load-db'
import { loadHospitableCalendar } from '@/lib/canary/load-hospitable-calendar'
import { loadHospitableTasks } from '@/lib/canary/load-hospitable-tasks'
import { loadOrgTasks } from '@/lib/canary/load-org-tasks'
import { fetchAllProperties, isHospitableConfigured } from '@/lib/hospitable/client'
import { createClient } from '@/lib/supabase/server'
import type { CanaryRole, HospitableCalendarData, HospitableTasksData } from '@/lib/canary/types'

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

  // Tenants use the dedicated portal (middleware also redirects; belt + suspenders)
  const isTenantOnly =
    caller.roles.includes('tenant') &&
    !caller.roles.some((r) => ['admin', 'manager', 'employee'].includes(r))
  if (isTenantOnly) redirect('/my-home')

  const isVendorOnly =
    caller.roles.includes('vendor') &&
    !caller.roles.some((r) => ['admin', 'manager', 'employee'].includes(r))

  const emptyHospitableCalendar: HospitableCalendarData = {
    strBookings: [],
    ownerOccupiedBlocks: [],
    connected: false,
    statusMessage: 'Not available in vendor portal.',
    propertyCount: 0,
  }
  const emptyHospitableTasks: HospitableTasksData = {
    tasks: [],
    connected: false,
    statusMessage: 'Not available in vendor portal.',
    openCount: 0,
  }

  const [db, orgTasks, userAvatarUrl, hospitableProperties] = await Promise.all([
    loadCanaryDb(caller.orgId, {
      redactForVendor: isVendorOnly,
      vendorPersonId: isVendorOnly ? caller.personId : undefined,
    }),
    loadOrgTasks(caller.orgId, {
      assigneeOnlyPersonId: isVendorOnly ? caller.personId : undefined,
    }),
    caller.avatarPath
      ? createClient().then((supabase) =>
          supabase.storage
            .from('org-assets')
            .createSignedUrl(caller.avatarPath!, 3600)
            .then(({ data }) => data?.signedUrl ?? null),
        )
      : Promise.resolve(null),
    !isVendorOnly && isHospitableConfigured()
      ? fetchAllProperties().catch((error) => {
          console.error('[CanaryAppPage] Hospitable properties fetch failed', error)
          return undefined
        })
      : Promise.resolve(undefined),
  ])

  const activeProperties = db.properties.filter((p) => !p.archivedAt)

  let hospitableCalendar: HospitableCalendarData = emptyHospitableCalendar
  let hospitableTasks: HospitableTasksData = emptyHospitableTasks
  if (!isVendorOnly) {
    hospitableCalendar = await loadHospitableCalendar(activeProperties, hospitableProperties)
    hospitableTasks = await loadHospitableTasks(
      activeProperties,
      hospitableCalendar.strBookings,
      hospitableProperties,
    )
  }

  const role = toCanaryRole(caller.roles)
  const canSwitchRoles = role === 'Admin' || role === 'Manager'

  return (
    <CanaryApp
      db={db}
      hospitableCalendar={hospitableCalendar}
      hospitableTasks={hospitableTasks}
      orgTasks={orgTasks}
      userRole={role}
      userPersonId={caller.personId}
      canSwitchRoles={canSwitchRoles}
      userName={caller.name}
      userAvatarUrl={userAvatarUrl}
      userOrgId={caller.orgId}
    />
  )
}
