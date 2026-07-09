import {
  fetchAllProperties,
  fetchTasks,
  isHospitableConfigured,
  type HospitableProperty,
} from '@/lib/hospitable/client'
import { isOpenHospitableTask, mapHospitableTasks } from '@/lib/hospitable/map-tasks'
import type { CanaryProperty, CanaryStrBooking, HospitableTasksData } from './types'

/** Look back a bit so recently overdue open tasks still appear. */
const PAST_DAYS = 14
/** Forward window for upcoming housekeeping / ops tasks. */
const FUTURE_DAYS = 120

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function dateWindow(): { startDate: string; endDate: string } {
  const now = new Date()
  const start = new Date(now.getTime() - PAST_DAYS * 864e5)
  const end = new Date(now.getTime() + FUTURE_DAYS * 864e5)
  return { startDate: formatDate(start), endDate: formatDate(end) }
}

const emptyTasks = (message: string): HospitableTasksData => ({
  tasks: [],
  connected: false,
  statusMessage: message,
  openCount: 0,
})

export async function loadHospitableTasks(
  canaryProperties: CanaryProperty[],
  strBookings: CanaryStrBooking[] = [],
  /** Optional pre-fetched Hospitable properties (avoids a second /v2/properties round-trip). */
  hospitableProperties?: HospitableProperty[]
): Promise<HospitableTasksData> {
  if (!isHospitableConfigured()) {
    return emptyTasks('Add HOSPITABLE_API_PAT to show Hospitable housekeeping and ops tasks.')
  }

  try {
    const properties = hospitableProperties ?? (await fetchAllProperties())
    if (!properties.length) {
      return {
        tasks: [],
        connected: true,
        statusMessage: 'Hospitable connected — no properties found.',
        openCount: 0,
      }
    }

    const { startDate, endDate } = dateWindow()
    const { tasks: rawTasks, taskTypeLabels } = await fetchTasks({
      propertyIds: properties.map((p) => p.id),
      startDate,
      endDate,
    })

    const tasks = mapHospitableTasks({
      tasks: rawTasks,
      taskTypeLabels,
      hospitableProperties: properties,
      canaryProperties,
      strBookings,
    })

    const openCount = tasks.filter(isOpenHospitableTask).length

    return {
      tasks,
      connected: true,
      statusMessage:
        tasks.length === 0
          ? 'No Hospitable tasks in the next few months.'
          : `${openCount} open · ${tasks.length} total in window`,
      openCount,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Hospitable fetch failed'
    console.error('[loadHospitableTasks]', error)
    const authHint =
      /\b401\b/.test(msg)
        ? ' Check that HOSPITABLE_API_PAT in Vercel Production matches a valid Hospitable Personal Access Token, then redeploy.'
        : ''
    return emptyTasks(`Hospitable tasks unavailable (${msg}).${authHint}`)
  }
}
