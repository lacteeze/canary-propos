'use client'

import React, { useMemo, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { parseIsoDate } from './DatePickerField'
import type { CanaryDraft, CanaryLease, CanaryStrBooking } from '@/lib/canary/types'
import { isPastLeaseStatus } from '@/lib/canary/types'

const MONO = "'IBM Plex Mono', monospace"
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_MS = 864e5

type DayFlags = { active: boolean; upcoming: boolean; draft: boolean; renewalSent: boolean; str: boolean }

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function dayInRange(day: Date, start: Date, end: Date): boolean {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()
  return d >= s && d <= e
}

function leaseCategory(l: CanaryLease): 'active' | 'upcoming' | 'past' | 'other' {
  if (l.status === 'Upcoming') return 'upcoming'
  if (l.status === 'Active' || l.status === 'Expiring') return 'active'
  if (isPastLeaseStatus(l.status)) return 'past'
  return 'other'
}

interface PropertyOccupancyCalendarProps {
  address: string
  shortLabel: string
  leases: CanaryLease[]
  drafts: CanaryDraft[]
  strBookings: CanaryStrBooking[]
  onClose: () => void
}

export default function PropertyOccupancyCalendar({
  address,
  shortLabel,
  leases,
  drafts,
  strBookings,
  onClose,
}: PropertyOccupancyCalendarProps) {
  const today = useMemo(() => new Date(), [])
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))

  const monthLabel = viewMonth.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })

  const cells = useMemo(() => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const first = new Date(year, month, 1)
    const startPad = first.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const out: Array<{ key: string; day: number | null; date: Date | null }> = []
    for (let i = 0; i < startPad; i++) out.push({ key: `pad-${i}`, day: null, date: null })
    for (let day = 1; day <= daysInMonth; day++) {
      out.push({ key: `d-${day}`, day, date: new Date(year, month, day) })
    }
    return out
  }, [viewMonth])

  const flagsByDay = useMemo(() => {
    const map = new Map<string, DayFlags>()
    const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const ensure = (d: Date): DayFlags => {
      const k = key(d)
      if (!map.has(k)) map.set(k, { active: false, upcoming: false, draft: false, renewalSent: false, str: false })
      return map.get(k)!
    }

    leases.forEach((l) => {
      const s = parseIsoDate(l.start) ?? parseDateFallback(l.start)
      const e = parseIsoDate(l.end) ?? parseDateFallback(l.end)
      if (!s || !e) return
      const cat = leaseCategory(l)
      if (cat !== 'active' && cat !== 'upcoming') return
      for (let t = s.getTime(); t <= e.getTime(); t += DAY_MS) {
        const d = new Date(t)
        if (d.getMonth() !== viewMonth.getMonth() || d.getFullYear() !== viewMonth.getFullYear()) continue
        const f = ensure(d)
        if (cat === 'active') f.active = true
        else f.upcoming = true
      }
    })

    drafts.forEach((d) => {
      const s = parseIsoDate(d.start) ?? parseDateFallback(d.start)
      const e = parseIsoDate(d.end) ?? parseDateFallback(d.end) ?? (s ? new Date(s.getTime() + 365 * DAY_MS) : null)
      if (!s || !e) return
      for (let t = s.getTime(); t <= e.getTime(); t += DAY_MS) {
        const day = new Date(t)
        if (day.getMonth() !== viewMonth.getMonth() || day.getFullYear() !== viewMonth.getFullYear()) continue
        const f = ensure(day)
        if (d.status === 'renewal_sent') f.renewalSent = true
        else f.draft = true
      }
    })

    strBookings.forEach((b) => {
      const s = parseIsoDate(b.start) ?? parseDateFallback(b.start)
      const e = parseIsoDate(b.end) ?? parseDateFallback(b.end)
      if (!s || !e) return
      for (let t = s.getTime(); t <= e.getTime(); t += DAY_MS) {
        const day = new Date(t)
        if (day.getMonth() !== viewMonth.getMonth() || day.getFullYear() !== viewMonth.getFullYear()) continue
        ensure(day).str = true
      }
    })

    return map
  }, [leases, drafts, strBookings, viewMonth])

  const shiftMonth = (delta: number) => {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  }

  const legend = [
    { label: 'Active lease', color: 'var(--green)' },
    { label: 'Upcoming lease', color: 'var(--amber)' },
    { label: 'Draft / listing', color: 'var(--accent)' },
    { label: 'Renewal sent', color: 'var(--purple)' },
    { label: 'STR booking', color: 'var(--blue)' },
  ]

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,8,6,.55)', zIndex: 72, backdropFilter: 'blur(2px)' }} />
      <div
        role="dialog"
        aria-label={`Occupancy calendar for ${shortLabel}`}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 'min(520px,94vw)',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: 'var(--panel)',
          border: '1px solid var(--border2)',
          borderRadius: 18,
          zIndex: 73,
          boxShadow: 'var(--shadow)',
          padding: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>
              Monthly occupancy
            </div>
            <div style={{ fontWeight: 700, fontSize: 19 }}>{shortLabel}</div>
            <div style={{ color: 'var(--dim)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{address}</div>
          </div>
          <button type="button" onClick={onClose} style={{ border: '1px solid var(--border)', background: 'var(--elev)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--dim)', flex: 'none' }}>
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
            style={{ border: '1px solid var(--border)', background: 'var(--elev)', borderRadius: 6, width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--dim)' }}
          >
            <ChevronLeftIcon size={16} />
          </button>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{monthLabel}</span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            style={{ border: '1px solid var(--border)', background: 'var(--elev)', borderRadius: 6, width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--dim)' }}
          >
            <ChevronRightIcon size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 6 }}>
          {WEEKDAYS.map((wd) => (
            <div key={wd} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--faint)', padding: '4px 0' }}>
              {wd}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {cells.map((cell) => {
            if (!cell.date || cell.day == null) {
              return <div key={cell.key} aria-hidden style={{ minHeight: 52 }} />
            }
            const fk = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`
            const flags = flagsByDay.get(fk) ?? { active: false, upcoming: false, draft: false, renewalSent: false, str: false }
            const isToday = sameDay(cell.date, today)
            const stripes = [
              flags.active ? 'var(--green)' : null,
              flags.upcoming ? 'var(--amber)' : null,
              flags.draft ? 'var(--accent)' : null,
              flags.renewalSent ? 'var(--purple)' : null,
              flags.str ? 'var(--blue)' : null,
            ].filter(Boolean) as string[]

            return (
              <div
                key={cell.key}
                title={stripes.length ? [flags.active && 'Active lease', flags.upcoming && 'Upcoming lease', flags.draft && 'Draft/listing', flags.renewalSent && 'Renewal sent', flags.str && 'STR booking'].filter(Boolean).join(' · ') : undefined}
                style={{
                  minHeight: 52,
                  border: isToday ? '1px solid var(--border2)' : '1px solid var(--border)',
                  borderRadius: 8,
                  background: stripes.length ? 'color-mix(in srgb, var(--elev) 70%, var(--panel))' : 'var(--elev)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '5px 6px 2px', fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--accent)' : 'var(--text)' }}>
                  {cell.day}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', gap: 2, padding: '0 4px 4px' }}>
                  {stripes.map((c, i) => (
                    <div key={i} style={{ height: 4, borderRadius: 2, background: c }} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          {legend.map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--dim)' }}>
              <span style={{ width: 14, height: 4, borderRadius: 2, background: item.color, flex: 'none' }} />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function parseDateFallback(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}
