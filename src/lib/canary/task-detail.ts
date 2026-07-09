import type { CanaryHospitableTask } from './types'

const MONO = "'IBM Plex Mono', monospace"

function parseTs(iso: string | null | undefined): Date | null {
  if (!iso?.trim()) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })
}

export function formatTaskDateTime(iso: string | null | undefined): string {
  const d = parseTs(iso)
  if (!d) return '—'
  return `${fmtDate(d)} · ${fmtTime(d)}`
}

/** Hospitable-style relative start line, e.g. "Starting 17 hours from now at 11:15 AM". */
export function formatTaskRelativeStart(iso: string | null | undefined, now = new Date()): string | null {
  const d = parseTs(iso)
  if (!d) return null
  const diffMs = d.getTime() - now.getTime()
  const absMs = Math.abs(diffMs)
  const future = diffMs > 0
  const timeStr = fmtTime(d)

  let span: string
  if (absMs < 60_000) {
    span = 'less than a minute'
  } else if (absMs < 3_600_000) {
    const mins = Math.round(absMs / 60_000)
    span = `${mins} minute${mins === 1 ? '' : 's'}`
  } else if (absMs < 86_400_000) {
    const hrs = Math.round(absMs / 3_600_000)
    span = `${hrs} hour${hrs === 1 ? '' : 's'}`
  } else {
    const days = Math.round(absMs / 86_400_000)
    span = `${days} day${days === 1 ? '' : 's'}`
  }

  if (future) return `Starting ${span} from now at ${timeStr}`
  if (absMs < 86_400_000) return `Started ${span} ago at ${timeStr}`
  return `Started on ${fmtDate(d)} at ${timeStr}`
}

/** Best-effort source line (Hospitable shows task-rule provenance; API does not expose rules). */
export function taskSourceLine(task: CanaryHospitableTask): string | null {
  if (task.reservationCode) {
    const guest =
      task.guestLabel && task.guestLabel !== '—' && !task.guestLabel.startsWith('Res ')
        ? ` · ${task.guestLabel}`
        : ''
    return `Linked to reservation ${task.reservationCode}${guest}`
  }
  if (task.name && task.name !== task.type) return task.name
  if (task.hospitablePropertyName && task.hospitablePropertyName !== task.property) {
    return `At ${task.hospitablePropertyName}`
  }
  return null
}

export function taskTypeTitle(task: CanaryHospitableTask): string {
  const type = task.type?.trim()
  if (!type) return 'Task'
  return type.toLowerCase().includes('task') ? type : `${type} task`
}

export function taskAssignmentBadge(task: CanaryHospitableTask): string | null {
  const raw = task.assignmentStatus?.trim()
  if (!raw) return task.teammate ? 'Assigned' : null
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export function taskStatusColor(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('complet')) return 'var(--green)'
  if (s.includes('progress') || s.includes('arrived') || s.includes('way')) return 'var(--blue)'
  if (s.includes('cancel') || s.includes('reject')) return 'var(--faint)'
  if (s.includes('accept')) return 'var(--green)'
  return 'var(--amber)'
}

export function teammateInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export { MONO as TASK_DETAIL_MONO }
