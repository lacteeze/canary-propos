'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePropertyDetails, type PropertyDetailsInput } from '@/app/actions/entity-updates'
import { parseIsoDate } from './DatePickerField'
import type {
  CanaryDraft,
  CanaryLease,
  CanaryProject,
  CanaryProperty,
  CanaryStrBooking,
} from '@/lib/canary/types'
import { isPastLeaseStatus } from '@/lib/canary/types'

const MONO = "'IBM Plex Mono', monospace"
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_MS = 864e5
const MONTHS_BEHIND = 3
const MONTHS_AHEAD = 9

const PROPERTY_STATUSES = ['Vacant', 'Leased', 'Maintenance'] as const
const PROPERTY_TYPES = ['house', 'duplex', 'apartment_building', 'condo', 'townhouse', 'other'] as const
const PET_OPTIONS = ['No pets', 'Pet friendly', 'Cat friendly', 'Dog friendly', 'By approval'] as const

type CalMode = 'occupancy' | 'tasks'
type MobilePane = 'calendar' | 'details'

type StayKind = 'active' | 'upcoming' | 'draft' | 'renewal' | 'str'

interface StayEvent {
  id: string
  kind: StayKind
  label: string
  start: Date
  end: Date
  color: string
}

interface MonthModel {
  key: string
  year: number
  month: number
  label: string
  weeks: Array<Array<{ key: string; day: number | null; date: Date | null }>>
}

const KIND_META: Record<StayKind, { label: string; color: string }> = {
  active: { label: 'Active lease', color: 'var(--green)' },
  upcoming: { label: 'Upcoming lease', color: 'var(--amber)' },
  draft: { label: 'Draft / listing', color: 'var(--accent)' },
  renewal: { label: 'Renewal sent', color: 'var(--purple)' },
  str: { label: 'STR stay', color: 'var(--blue)' },
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function parseDateFallback(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseDay(s: string | null | undefined): Date | null {
  return parseIsoDate(s) ?? parseDateFallback(s)
}

function leaseCategory(l: CanaryLease): 'active' | 'upcoming' | 'past' | 'other' {
  if (l.status === 'Upcoming') return 'upcoming'
  if (l.status === 'Active' || l.status === 'Expiring') return 'active'
  if (isPastLeaseStatus(l.status)) return 'past'
  return 'other'
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function buildMonth(year: number, month: number): MonthModel {
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<{ key: string; day: number | null; date: Date | null }> = []
  for (let i = 0; i < startPad; i++) cells.push({ key: `pad-${year}-${month}-${i}`, day: null, date: null })
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ key: `d-${year}-${month}-${day}`, day, date: new Date(year, month, day) })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `trail-${year}-${month}-${cells.length}`, day: null, date: null })
  }
  const weeks: MonthModel['weeks'] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return {
    key: monthKey(year, month),
    year,
    month,
    label: first.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }),
    weeks,
  }
}

function tenantLabel(info: string | null | undefined): string {
  if (!info) return 'Tenant'
  return info.split(/[,;/|]/)[0]?.trim() || 'Tenant'
}

function formLabel(text: string): React.ReactNode {
  return (
    <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--dim)', marginBottom: 4 }}>
      {text}
    </span>
  )
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--input)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '7px 10px',
  fontWeight: 600,
  fontSize: 12.5,
  color: 'var(--text)',
}

interface PropertyOccupancyCalendarProps {
  property: CanaryProperty
  address: string
  shortLabel: string
  leases: CanaryLease[]
  drafts: CanaryDraft[]
  strBookings: CanaryStrBooking[]
  projects: CanaryProject[]
  portfolios: { id: string; name: string }[]
  owners: { id: string; name: string }[]
  canEdit: boolean
  priv: boolean
  money: (n: number | null | undefined) => string
  onClose: () => void
  onOpenProject?: (id: string) => void
}

function PropertyQuickEdit({
  property,
  portfolios,
  owners,
  canEdit,
  priv,
  money,
  onSaved,
}: {
  property: CanaryProperty
  portfolios: { id: string; name: string }[]
  owners: { id: string; name: string }[]
  canEdit: boolean
  priv: boolean
  money: (n: number | null | undefined) => string
  onSaved: () => void
}) {
  const [status, setStatus] = useState(
    PROPERTY_STATUSES.includes(property.status as (typeof PROPERTY_STATUSES)[number]) ? property.status : 'Vacant',
  )
  const [propertyType, setPropertyType] = useState(property.type.replace(/ /g, '_') || 'house')
  const [city, setCity] = useState(property.city)
  const [province, setProvince] = useState(property.area)
  const [beds, setBeds] = useState(property.beds || '0')
  const [baths, setBaths] = useState(property.baths || '0')
  const [rent, setRent] = useState(property.rate != null ? String(property.rate) : '')
  const [pets, setPets] = useState(
    PET_OPTIONS.includes(property.petFriendly as (typeof PET_OPTIONS)[number]) ? property.petFriendly : 'No pets',
  )
  const [portfolioId, setPortfolioId] = useState(property.portfolioId)
  const [ownerId, setOwnerId] = useState(property.ownerId)
  const [feeType, setFeeType] = useState(property.mgmtFeeType === 'flat' ? 'flat' : 'percent')
  const [feeValue, setFeeValue] = useState(property.mgmtFeeValue)
  const [hospitablePropertyId, setHospitablePropertyId] = useState(property.hospitablePropertyId || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)

  useEffect(() => {
    setStatus(PROPERTY_STATUSES.includes(property.status as (typeof PROPERTY_STATUSES)[number]) ? property.status : 'Vacant')
    setPropertyType(property.type.replace(/ /g, '_') || 'house')
    setCity(property.city)
    setProvince(property.area)
    setBeds(property.beds || '0')
    setBaths(property.baths || '0')
    setRent(property.rate != null ? String(property.rate) : '')
    setPets(PET_OPTIONS.includes(property.petFriendly as (typeof PET_OPTIONS)[number]) ? property.petFriendly : 'No pets')
    setPortfolioId(property.portfolioId)
    setOwnerId(property.ownerId)
    setFeeType(property.mgmtFeeType === 'flat' ? 'flat' : 'percent')
    setFeeValue(property.mgmtFeeValue)
    setHospitablePropertyId(property.hospitablePropertyId || '')
    setErr('')
    setOk(false)
  }, [property])

  if (!canEdit) {
    return (
      <div className="cy-cal-side-readonly">
        <div className="cy-cal-side-section-title">Overview</div>
        <dl className="cy-cal-side-dl">
          <div><dt>Status</dt><dd>{property.status || '—'}</dd></div>
          <div><dt>Type</dt><dd>{property.type || '—'}</dd></div>
          <div><dt>Area</dt><dd>{[property.city, property.area].filter(Boolean).join(' · ') || '—'}</dd></div>
          <div><dt>Beds / Baths</dt><dd>{[property.beds || '—', property.baths || '—'].join(' / ')}</dd></div>
          <div><dt>Asking rate</dt><dd>{property.rate != null ? `${money(property.rate)}/mo` : '—'}</dd></div>
          <div><dt>Pets</dt><dd>{property.petFriendly || '—'}</dd></div>
          {priv && (
            <>
              <div><dt>Portfolio</dt><dd>{portfolios.find((p) => p.id === property.portfolioId)?.name ?? '—'}</dd></div>
              <div><dt>Owner</dt><dd>{owners.find((o) => o.id === property.ownerId)?.name ?? '—'}</dd></div>
            </>
          )}
        </dl>
      </div>
    )
  }

  const save = async () => {
    setErr('')
    setOk(false)
    const bedsN = parseInt(beds, 10)
    const bathsN = parseFloat(baths)
    if (Number.isNaN(bedsN) || bedsN < 0) return setErr('Invalid bedroom count.')
    if (Number.isNaN(bathsN) || bathsN < 0) return setErr('Invalid bathroom count.')
    const rentN = rent.trim() === '' ? null : parseFloat(rent.replace(/[$,]/g, ''))
    if (rentN != null && (Number.isNaN(rentN) || rentN < 0)) return setErr('Invalid asking rent.')
    const feeN = feeValue.trim() === '' ? null : parseFloat(feeValue)
    if (feeN != null && (Number.isNaN(feeN) || feeN < 0)) return setErr('Invalid management fee.')
    const hospId = hospitablePropertyId.trim()
    if (hospId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hospId)) {
      return setErr('Hospitable property ID must be a UUID (or leave blank).')
    }

    const payload: PropertyDetailsInput = {
      status: status as PropertyDetailsInput['status'],
      bedrooms: bedsN,
      bathrooms: bathsN,
      askingRent: rentN,
      pets: pets as PropertyDetailsInput['pets'],
      propertyType: propertyType as PropertyDetailsInput['propertyType'],
      city: city.trim(),
      province: province.trim(),
      portfolioId: portfolioId || null,
      ownerId: ownerId || null,
      managementFeeType: feeType as PropertyDetailsInput['managementFeeType'],
      managementFeeValue: feeN,
      hospitablePropertyId: hospId || null,
    }
    setSaving(true)
    const res = await updatePropertyDetails(property.unitId, payload)
    setSaving(false)
    if (res.success) {
      setOk(true)
      onSaved()
    } else {
      setErr(res.error ?? 'Failed to save.')
    }
  }

  return (
    <div className="cy-cal-side-form">
      <div className="cy-cal-side-section-title">Quick edit</div>
      <div className="cy-cal-side-grid">
        <label>{formLabel('Status')}
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={fieldStyle}>
            {PROPERTY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>{formLabel('Type')}
          <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} style={fieldStyle}>
            {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </label>
        <label>{formLabel('City')}
          <input value={city} onChange={(e) => setCity(e.target.value)} style={fieldStyle} />
        </label>
        <label>{formLabel('Province / area')}
          <input value={province} onChange={(e) => setProvince(e.target.value)} style={fieldStyle} />
        </label>
        <label>{formLabel('Bedrooms')}
          <input type="number" min={0} value={beds} onChange={(e) => setBeds(e.target.value)} style={fieldStyle} />
        </label>
        <label>{formLabel('Bathrooms')}
          <input type="number" min={0} step={0.5} value={baths} onChange={(e) => setBaths(e.target.value)} style={fieldStyle} />
        </label>
        <label>{formLabel('Asking rent ($/mo)')}
          <input type="number" min={0} value={rent} onChange={(e) => setRent(e.target.value)} style={fieldStyle} />
        </label>
        <label>{formLabel('Pets')}
          <select value={pets} onChange={(e) => setPets(e.target.value)} style={fieldStyle}>
            {PET_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      </div>

      {priv && (
        <div style={{ marginTop: 14 }}>
          <div className="cy-cal-side-section-title">Staff only</div>
          <div className="cy-cal-side-grid">
            <label>{formLabel('Portfolio')}
              <select value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)} style={fieldStyle}>
                <option value="">— None —</option>
                {portfolios.map((pf) => <option key={pf.id} value={pf.id}>{pf.name}</option>)}
              </select>
            </label>
            <label>{formLabel('Owner')}
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} style={fieldStyle}>
                <option value="">— None —</option>
                {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <label>{formLabel('Fee type')}
              <select value={feeType} onChange={(e) => setFeeType(e.target.value)} style={fieldStyle}>
                <option value="percent">Percent (%)</option>
                <option value="flat">Flat ($)</option>
              </select>
            </label>
            <label>{formLabel(feeType === 'percent' ? 'Mgmt fee (%)' : 'Mgmt fee ($)')}
              <input type="number" min={0} value={feeValue} onChange={(e) => setFeeValue(e.target.value)} style={fieldStyle} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>{formLabel('Hospitable property ID')}
              <input
                type="text"
                value={hospitablePropertyId}
                onChange={(e) => setHospitablePropertyId(e.target.value)}
                placeholder="UUID or blank"
                style={{ ...fieldStyle, fontFamily: MONO, fontSize: 11.5 }}
              />
            </label>
          </div>
        </div>
      )}

      {err && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 10 }}>{err}</div>}
      {ok && !err && <div style={{ color: 'var(--green)', fontSize: 12, marginTop: 10 }}>Saved.</div>}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="cy-btn-primary cy-accent-btn"
        style={{ width: '100%', marginTop: 14, opacity: saving ? 0.65 : 1 }}
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  )
}

function WeekBars({
  week,
  events,
}: {
  week: Array<{ key: string; day: number | null; date: Date | null }>
  events: StayEvent[]
}) {
  const weekStart = week.find((c) => c.date)?.date
  const weekEnd = [...week].reverse().find((c) => c.date)?.date
  if (!weekStart || !weekEnd) return null

  const ws = startOfDay(weekStart).getTime()
  const we = startOfDay(weekEnd).getTime()

  type LaneSeg = { event: StayEvent; colStart: number; colEnd: number; showLabel: boolean }
  const segs: LaneSeg[] = []

  events.forEach((ev) => {
    const es = startOfDay(ev.start).getTime()
    const ee = startOfDay(ev.end).getTime()
    if (ee < ws || es > we) return
    let colStart = -1
    let colEnd = -1
    week.forEach((cell, i) => {
      if (!cell.date) return
      const t = startOfDay(cell.date).getTime()
      if (t >= es && t <= ee) {
        if (colStart < 0) colStart = i
        colEnd = i
      }
    })
    if (colStart < 0) return
    const showLabel = es >= ws && es <= we
    segs.push({ event: ev, colStart, colEnd, showLabel })
  })

  if (!segs.length) return null

  const lanes: LaneSeg[][] = []
  segs
    .sort((a, b) => a.colStart - b.colStart || b.colEnd - b.colStart - (a.colEnd - a.colStart))
    .forEach((seg) => {
      let placed = false
      for (const lane of lanes) {
        if (lane.every((s) => seg.colEnd < s.colStart || seg.colStart > s.colEnd)) {
          lane.push(seg)
          placed = true
          break
        }
      }
      if (!placed) lanes.push([seg])
    })

  const maxLanes = Math.min(lanes.length, 3)

  return (
    <div className="cy-cal-week-bars" aria-hidden={false}>
      {lanes.slice(0, maxLanes).map((lane, li) =>
        lane.map((seg) => {
          const span = seg.colEnd - seg.colStart + 1
          const label = seg.showLabel ? seg.event.label : ''
          return (
            <div
              key={`${seg.event.id}-${seg.colStart}-${li}`}
              className="cy-cal-bar"
              title={`${seg.event.label} · ${KIND_META[seg.event.kind].label}`}
              style={{
                gridColumn: `${seg.colStart + 1} / span ${span}`,
                gridRow: li + 1,
                background: seg.event.color,
              }}
            >
              {label && <span className="cy-cal-bar-label">{label}</span>}
            </div>
          )
        }),
      )}
      {lanes.length > maxLanes && (
        <div className="cy-cal-bar-more" style={{ gridColumn: '1 / -1', gridRow: maxLanes + 1 }}>
          +{lanes.length - maxLanes} more
        </div>
      )}
    </div>
  )
}

export default function PropertyOccupancyCalendar({
  property,
  address,
  shortLabel,
  leases,
  drafts,
  strBookings,
  projects,
  portfolios,
  owners,
  canEdit,
  priv,
  money,
  onClose,
  onOpenProject,
}: PropertyOccupancyCalendarProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const today = useMemo(() => startOfDay(new Date()), [])
  const [mode, setMode] = useState<CalMode>('occupancy')
  const [mobilePane, setMobilePane] = useState<MobilePane>('calendar')
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentMonthRef = useRef<HTMLElement | null>(null)

  const months = useMemo(() => {
    const base = new Date(today.getFullYear(), today.getMonth(), 1)
    const out: MonthModel[] = []
    for (let i = -MONTHS_BEHIND; i <= MONTHS_AHEAD; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1)
      out.push(buildMonth(d.getFullYear(), d.getMonth()))
    }
    return out
  }, [today])

  const events = useMemo(() => {
    const list: StayEvent[] = []

    leases.forEach((l) => {
      const s = parseDay(l.start)
      const e = parseDay(l.end)
      if (!s || !e) return
      const cat = leaseCategory(l)
      if (cat !== 'active' && cat !== 'upcoming') return
      const kind: StayKind = cat === 'active' ? 'active' : 'upcoming'
      list.push({
        id: `lease-${l.id}`,
        kind,
        label: tenantLabel(l.tenantInfo),
        start: s,
        end: e,
        color: KIND_META[kind].color,
      })
    })

    drafts.forEach((d) => {
      const s = parseDay(d.start)
      const e = parseDay(d.end) ?? (s ? new Date(s.getTime() + 365 * DAY_MS) : null)
      if (!s || !e) return
      const kind: StayKind = d.status === 'renewal_sent' ? 'renewal' : 'draft'
      list.push({
        id: `draft-${d.id}`,
        kind,
        label: d.status === 'renewal_sent' ? 'Renewal sent' : 'Draft listing',
        start: s,
        end: e,
        color: KIND_META[kind].color,
      })
    })

    strBookings.forEach((b) => {
      const s = parseDay(b.start)
      const e = parseDay(b.end)
      if (!s || !e) return
      // Checkout day is still shown so the stay bar reaches the departure date.
      list.push({
        id: `str-${b.id}`,
        kind: 'str',
        label: b.guestLabel || b.platform || 'Guest',
        start: s,
        end: e,
        color: KIND_META.str.color,
      })
    })

    return list
  }, [leases, drafts, strBookings])

  const propertyProjects = useMemo(
    () => projects.filter((j) => j.property === address || j.propertyDbId === property.propertyDbId),
    [projects, address, property.propertyDbId],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    // Scroll current month into view after mount
    const t = window.setTimeout(() => {
      currentMonthRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior })
    }, 30)
    return () => window.clearTimeout(t)
  }, [])

  const refresh = useCallback(() => {
    startTransition(() => router.refresh())
  }, [router])

  const legend = (Object.keys(KIND_META) as StayKind[]).map((k) => KIND_META[k])

  return (
    <>
      <div onClick={onClose} className="cy-modal-backdrop cy-cal-backdrop" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Property calendar for ${shortLabel}`}
        className="cy-glass-modal cy-cal-modal"
      >
        <header className="cy-cal-header">
          <div className="cy-cal-header-main">
            <div className="cy-eyebrow" style={{ marginBottom: 2 }}>Property calendar</div>
            <div className="cy-cal-title">{shortLabel}</div>
            <div className="cy-cal-sub">{address}</div>
          </div>

          <div className="cy-cal-header-controls">
            <div className="cy-cal-mode-toggle" role="tablist" aria-label="Calendar mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'occupancy'}
                className={mode === 'occupancy' ? 'is-active' : ''}
                onClick={() => setMode('occupancy')}
              >
                Occupancy
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'tasks'}
                className={mode === 'tasks' ? 'is-active' : ''}
                onClick={() => setMode('tasks')}
              >
                Tasks{propertyProjects.length ? ` (${propertyProjects.length})` : ''}
              </button>
            </div>

            <div className="cy-cal-mobile-tabs" role="tablist" aria-label="Mobile panel">
              <button
                type="button"
                className={mobilePane === 'calendar' ? 'is-active' : ''}
                onClick={() => setMobilePane('calendar')}
              >
                Calendar
              </button>
              <button
                type="button"
                className={mobilePane === 'details' ? 'is-active' : ''}
                onClick={() => setMobilePane('details')}
              >
                Details
              </button>
            </div>

            <button type="button" className="cy-btn" onClick={onClose} aria-label="Close calendar">
              ✕
            </button>
          </div>
        </header>

        <div className={`cy-cal-body cy-cal-body--${mobilePane}`}>
          <div className="cy-cal-main" ref={scrollRef}>
            {mode === 'occupancy' ? (
              <>
                <div className="cy-cal-legend">
                  {legend.map((item) => (
                    <div key={item.label} className="cy-cal-legend-item">
                      <span style={{ background: item.color }} />
                      {item.label}
                    </div>
                  ))}
                </div>

                {months.map((m) => {
                  const isCurrent = m.year === today.getFullYear() && m.month === today.getMonth()
                  return (
                    <section
                      key={m.key}
                      className={`cy-cal-month${isCurrent ? ' is-current' : ''}`}
                      ref={isCurrent ? (el) => { currentMonthRef.current = el } : undefined}
                    >
                      <h3 className="cy-cal-month-label">{m.label}</h3>
                      <div className="cy-cal-weekday-row">
                        {WEEKDAYS.map((wd) => (
                          <div key={wd}>{wd}</div>
                        ))}
                      </div>
                      {m.weeks.map((week, wi) => (
                        <div key={`${m.key}-w${wi}`} className="cy-cal-week">
                          <div className="cy-cal-week-days">
                            {week.map((cell) => {
                              if (!cell.date || cell.day == null) {
                                return <div key={cell.key} className="cy-cal-day is-empty" aria-hidden />
                              }
                              const isToday = sameDay(cell.date, today)
                              return (
                                <div
                                  key={cell.key}
                                  className={`cy-cal-day${isToday ? ' is-today' : ''}`}
                                >
                                  <span className="cy-cal-day-num">{cell.day}</span>
                                </div>
                              )
                            })}
                          </div>
                          <WeekBars week={week} events={events} />
                        </div>
                      ))}
                    </section>
                  )
                })}
              </>
            ) : (
              <div className="cy-cal-tasks">
                <div className="cy-cal-side-section-title">Tasks & projects</div>
                {propertyProjects.length === 0 ? (
                  <div className="cy-cal-tasks-empty">
                    <p>No open tasks for this property yet.</p>
                    <p style={{ color: 'var(--faint)', fontSize: 12.5, marginTop: 6 }}>
                      Maintenance and project work will show here when linked to this unit.
                    </p>
                  </div>
                ) : (
                  <ul className="cy-cal-tasks-list">
                    {propertyProjects.map((j) => (
                      <li key={j.id}>
                        <button
                          type="button"
                          className="cy-cal-task-row"
                          onClick={() => onOpenProject?.(j.id)}
                          disabled={!onOpenProject}
                        >
                          <span className="cy-cal-task-status">{j.status || '—'}</span>
                          <span className="cy-cal-task-name">{j.name}</span>
                          {j.priority && <span className="cy-cal-task-priority">{j.priority}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <aside className="cy-cal-side">
            <PropertyQuickEdit
              property={property}
              portfolios={portfolios}
              owners={owners}
              canEdit={canEdit}
              priv={priv}
              money={money}
              onSaved={refresh}
            />
          </aside>
        </div>
      </div>
    </>
  )
}
