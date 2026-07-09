import type { CanaryStrBooking } from './types'
import { formatTaskDateTime, formatTaskRelativeStart } from './task-detail'

export function bookingStatusLabel(status: string): string {
  const s = status.trim().toLowerCase()
  if (!s || s === 'unknown') return 'Unknown'
  if (s === 'request') return 'Pending request'
  if (s === 'accepted') return 'Confirmed'
  if (s === 'cancelled') return 'Cancelled'
  if (s === 'not_accepted') return 'Not accepted'
  return s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function bookingStatusColor(status: string): string {
  const s = status.trim().toLowerCase()
  if (s === 'request') return 'var(--amber)'
  if (s === 'accepted') return 'var(--green)'
  if (s === 'cancelled' || s === 'not_accepted') return 'var(--red)'
  return 'var(--blue)'
}

export function bookingSourceLine(booking: CanaryStrBooking): string | null {
  const parts = [booking.platform, booking.nights ? `${booking.nights} night${booking.nights === 1 ? '' : 's'}` : ''].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

export function formatBookingDateRange(start: string, end: string): string {
  if (!start && !end) return '—'
  if (start && end) return `${start} → ${end}`
  return start || end
}

export function formatBookingCheckInRelative(booking: CanaryStrBooking): string | null {
  return formatTaskRelativeStart(booking.checkInAt || `${booking.start}T12:00:00`)
}

export { formatTaskDateTime as formatBookingDateTime }
