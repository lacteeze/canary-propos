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
import type { CanaryRole, HospitableCalendarData, HospitableTasksData, OrgTasksData } from '@/lib/canary/types'

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

  const isVendorOnly =
    caller.roles.includes('vendor') &&
    !caller.roles.some((r) => ['admin', 'manager', 'employee'].includes(r))
  const db = await loadCanaryDb(caller.orgId, {
    redactForVendor: isVendorOnly,
    vendorPersonId: isVendorOnly ? caller.personId : undefined,
  })
  // STR/task matching should not bind to archived units (keeps them off the leasing timeline).
  const activeProperties = db.properties.filter((p) => !p.archivedAt)

  // Vendors never receive Hospitable STR/tasks (cross-org API key would leak Canary inventory).
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

  let hospitableCalendar: HospitableCalendarData = emptyHospitableCalendar
  let hospitableTasks: HospitableTasksData = emptyHospitableTasks

  if (!isVendorOnly) {
    // One properties fetch shared by calendar + tasks loaders
    let hospitableProperties: Awaited<ReturnType<typeof fetchAllProperties>> | undefined
    if (isHospitableConfigured()) {
      try {
        hospitableProperties = await fetchAllProperties()
      } catch (error) {
        console.error('[CanaryAppPage] Hospitable properties fetch failed', error)
      }
    }

    hospitableCalendar = await loadHospitableCalendar(activeProperties, hospitableProperties)
    hospitableTasks = await loadHospitableTasks(
      activeProperties,
      hospitableCalendar.strBookings,
      hospitableProperties
    )
  }

  // Team tasks: vendors only see tasks assigned/shared to them
  const orgTasks: OrgTasksData = await loadOrgTasks(caller.orgId, {
    assigneeOnlyPersonId: isVendorOnly ? caller.personId : undefined,
  })

  const role = toCanaryRole(caller.roles)
  const canSwitchRoles = role === 'Admin' || role === 'Manager'

  let userAvatarUrl: string | null = null
  if (caller.avatarPath) {
    const supabase = await createClient()
    const { data } = await supabase.storage
      .from('org-assets')
      .createSignedUrl(caller.avatarPath, 3600)
    userAvatarUrl = data?.signedUrl ?? null
  }

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
