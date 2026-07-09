import type { CanaryHospitableTask, CanaryProperty, CanaryStrBooking } from '@/lib/canary/types'
import type { HospitableProperty, HospitableTask } from './client'
import { resolveHospitablePropertyAddresses } from './match-property'
import { hospitablePropertyLabel } from './property-label'

const CLOSED_PROGRESS = new Set(['completed', 'cancelled'])
const CLOSED_ASSIGNMENT = new Set(['rejected', 'cancelled'])

const DEFAULT_TASK_TYPES: Record<number, string> = {
  1: 'Cleaning',
  2: 'Check-in',
  3: 'Concierge',
  4: 'Check-out',
  5: 'Maintenance',
}

function titleCaseStatus(raw: string): string {
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export function deriveTaskStatus(task: HospitableTask): string {
  const progress = task.progress_status?.trim()
  if (progress) return titleCaseStatus(progress)

  const assignment = task.task_assignment?.status?.trim()
  if (assignment) return titleCaseStatus(assignment)

  if (!task.task_assignment) return 'Unassigned'
  return 'Pending'
}

/** Open / active = not completed/cancelled progress and not rejected/cancelled assignment. */
export function isOpenHospitableTask(task: Pick<CanaryHospitableTask, 'progressStatus' | 'assignmentStatus'>): boolean {
  const progress = (task.progressStatus || '').toLowerCase()
  if (progress && CLOSED_PROGRESS.has(progress)) return false

  const assignment = (task.assignmentStatus || '').toLowerCase()
  if (assignment && CLOSED_ASSIGNMENT.has(assignment)) return false

  return true
}

function dateOnly(iso: string | undefined | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export function mapHospitableTasks(params: {
  tasks: HospitableTask[]
  taskTypeLabels: Record<number, string>
  hospitableProperties: HospitableProperty[]
  canaryProperties: CanaryProperty[]
  strBookings?: CanaryStrBooking[]
}): CanaryHospitableTask[] {
  const { tasks, taskTypeLabels, hospitableProperties, canaryProperties, strBookings = [] } = params
  const propertyById = new Map(hospitableProperties.map((p) => [p.id, p]))
  const addressByHospitableId = resolveHospitablePropertyAddresses(hospitableProperties, canaryProperties)
  const guestByReservationId = new Map(
    strBookings.filter((b) => b.id).map((b) => [b.id, b.guestLabel] as const)
  )

  const typeLabels = { ...DEFAULT_TASK_TYPES, ...taskTypeLabels }

  const mapped: CanaryHospitableTask[] = tasks.map((task) => {
    const propertyId = task.property?.id ?? ''
    const hp = propertyId ? propertyById.get(propertyId) : undefined
    const propertyKey =
      (propertyId ? addressByHospitableId.get(propertyId) : undefined) ??
      (hp
        ? hospitablePropertyLabel(hp)
        : (task.property?.name?.trim() || 'STR property'))

    const typeNum = task.task_type ?? null
    const typeLabel =
      (typeNum != null && typeLabels[typeNum]) ||
      (typeNum != null ? `Type ${typeNum}` : 'Task')

    const reservationId = task.reservation?.id ?? ''
    const reservationCode = task.reservation?.code?.trim() ?? ''
    const guestLabel =
      (reservationId ? guestByReservationId.get(reservationId) : undefined) ||
      (reservationCode ? `Res ${reservationCode}` : '—')

    const progressStatus = task.progress_status?.trim() || ''
    const assignmentStatus = task.task_assignment?.status?.trim() || ''

    return {
      id: task.id,
      name: task.name?.trim() || typeLabel,
      property: propertyKey,
      hospitablePropertyId: propertyId,
      hospitablePropertyName: hp ? hospitablePropertyLabel(hp) : (task.property?.name?.trim() || propertyKey),
      guestLabel,
      dueDate: dateOnly(task.start_date) || dateOnly(task.end_date),
      startAt: task.start_date ?? '',
      endAt: task.end_date ?? '',
      status: deriveTaskStatus(task),
      progressStatus,
      assignmentStatus,
      type: typeLabel,
      typeId: typeNum,
      teammate: task.teammate?.name?.trim() || '',
      reservationCode,
      reservationId,
      note: task.note?.trim() || '',
      timezone: task.timezone?.trim() || '',
      durationHours: task.duration_hours ?? null,
      serviceId: task.service_id ?? null,
      assignmentUpdatedAt: task.task_assignment?.updated_at?.trim() || '',
    }
  })

  return mapped.sort((a, b) => {
    const ad = a.dueDate || a.startAt || ''
    const bd = b.dueDate || b.startAt || ''
    return ad.localeCompare(bd) || a.name.localeCompare(b.name)
  })
}
