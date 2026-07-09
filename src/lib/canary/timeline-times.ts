import type { LeaseTermType } from './lease-term'
import type { CanaryStrBooking } from './types'

/** STR default check-in: 4:00 PM on arrival date */
export const STR_DEFAULT_CHECK_IN_HOUR = 16
export const STR_DEFAULT_CHECK_IN_MINUTE = 0

/** STR default check-out: 11:00 AM on departure date */
export const STR_DEFAULT_CHECK_OUT_HOUR = 11
export const STR_DEFAULT_CHECK_OUT_MINUTE = 0

/** Lease bar starts at 12:01 AM on start date */
export const LEASE_START_HOUR = 0
export const LEASE_START_MINUTE = 1

/** Lease bar ends at end of day on end date */
export const LEASE_END_HOUR = 23
export const LEASE_END_MINUTE = 59
export const LEASE_END_SECOND = 59
export const LEASE_END_MS = 999

export type TimelineRange = { startMs: number; endMs: number }

function parseDateOnlyLocal(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) }
}

export function hasTimeComponent(s: string): boolean {
  return s.includes('T') || /^\d{4}-\d{2}-\d{2}[ T]\d/.test(s.trim())
}

export function parseTimestamp(s: string | null | undefined): Date | null {
  if (!s) return null
  const trimmed = s.trim()
  if (!trimmed) return null
  const d = new Date(trimmed)
  return Number.isNaN(d.getTime()) ? null : d
}

export function dateAtLocalTime(
  dateStr: string,
  hour: number,
  minute: number,
  second = 0,
  ms = 0
): Date | null {
  const parts = parseDateOnlyLocal(dateStr)
  if (!parts) {
    const parsed = parseTimestamp(dateStr)
    if (!parsed) return null
    return new Date(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate(),
      hour,
      minute,
      second,
      ms
    )
  }
  return new Date(parts.y, parts.m, parts.d, hour, minute, second, ms)
}

export function resolveTimestampFromFields(
  fields: Array<string | null | undefined>,
  dateOnly: string,
  defaultHour: number,
  defaultMinute: number
): string {
  for (const field of fields) {
    if (!field) continue
    if (hasTimeComponent(field)) {
      const d = parseTimestamp(field)
      if (d) return d.toISOString()
    }
  }
  const d = dateAtLocalTime(dateOnly, defaultHour, defaultMinute)
  return d ? d.toISOString() : ''
}

/** True when ranges share interior time; touching endpoints do not overlap. */
export function tlRangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1
}

export function leaseBarRange(start: string, end: string): TimelineRange | null {
  const startParts = parseDateOnlyLocal(start)
  const endParts = parseDateOnlyLocal(end)
  if (!startParts || !endParts) return null
  const s = new Date(
    startParts.y,
    startParts.m,
    startParts.d,
    LEASE_START_HOUR,
    LEASE_START_MINUTE,
    0,
    0
  )
  const e = new Date(
    endParts.y,
    endParts.m,
    endParts.d,
    LEASE_END_HOUR,
    LEASE_END_MINUTE,
    LEASE_END_SECOND,
    LEASE_END_MS
  )
  return { startMs: s.getTime(), endMs: e.getTime() }
}

/**
 * Resolve timeline bar span.
 * Open-ended leases (no end date) extend through `throughMs` (usually the
 * visible window end) so they fill the calendar for as long as the tenant
 * could stay. `termType` is kept for call-site compatibility.
 */
export function leaseBarRangeForLease(
  start: string,
  end: string,
  _termType?: LeaseTermType | string | null,
  throughMs?: number
): TimelineRange | null {
  const trimmedEnd = end?.trim()
  if (trimmedEnd) return leaseBarRange(start, trimmedEnd)

  const startParts = parseDateOnlyLocal(start)
  if (!startParts) return null
  const startMs = new Date(
    startParts.y,
    startParts.m,
    startParts.d,
    LEASE_START_HOUR,
    LEASE_START_MINUTE,
    0,
    0
  ).getTime()

  if (throughMs != null && throughMs > startMs) {
    return { startMs, endMs: throughMs }
  }

  // Fallback when no window is provided: 12 months from start.
  const synthetic = new Date(startParts.y, startParts.m, startParts.d)
  synthetic.setMonth(synthetic.getMonth() + 12)
  return {
    startMs,
    endMs: new Date(
      synthetic.getFullYear(),
      synthetic.getMonth(),
      synthetic.getDate(),
      LEASE_END_HOUR,
      LEASE_END_MINUTE,
      LEASE_END_SECOND,
      LEASE_END_MS
    ).getTime(),
  }
}

export function draftBarRange(
  start: string,
  end: string | null | undefined,
  fallbackSpanMs: number
): TimelineRange | null {
  const trimmed = start?.trim()
  if (!trimmed) return null
  const startRange = leaseBarRange(trimmed, trimmed)
  if (!startRange) return null
  let endMs = startRange.startMs + fallbackSpanMs
  if (end) {
    const endRange = leaseBarRange(end, end)
    if (endRange) endMs = endRange.endMs
  }
  return { startMs: startRange.startMs, endMs }
}

export function strBarRange(booking: CanaryStrBooking): TimelineRange | null {
  const checkIn =
    booking.checkInAt ??
    resolveTimestampFromFields(
      [],
      booking.start,
      STR_DEFAULT_CHECK_IN_HOUR,
      STR_DEFAULT_CHECK_IN_MINUTE
    )
  const checkOut =
    booking.checkOutAt ??
    resolveTimestampFromFields(
      [],
      booking.end,
      STR_DEFAULT_CHECK_OUT_HOUR,
      STR_DEFAULT_CHECK_OUT_MINUTE
    )
  const s = parseTimestamp(checkIn)
  const e = parseTimestamp(checkOut)
  if (!s || !e) return null
  return { startMs: s.getTime(), endMs: e.getTime() }
}
