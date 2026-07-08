'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

export function parseIsoDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

export function formatDisplayDate(s: string | null | undefined): string {
  const d = parseIsoDate(s)
  return d ? d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

interface DatePickerFieldProps {
  value: string
  onChange: (iso: string) => void
  placeholder?: string
}

export default function DatePickerField({ value, onChange, placeholder = 'Pick date' }: DatePickerFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const selected = parseIsoDate(value)
  const [viewMonth, setViewMonth] = useState(() => selected ?? new Date())

  useEffect(() => {
    if (selected) setViewMonth(selected)
  }, [value])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const monthLabel = viewMonth.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
  const today = useMemo(() => new Date(), [])

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

  const pick = (date: Date) => {
    onChange(toIsoDate(date))
    setOpen(false)
  }

  const shiftMonth = (delta: number) => {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  }

  const display = formatDisplayDate(value)

  return (
    <div ref={rootRef} className="cy-date-picker" style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        className="cy-date-picker-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: 'var(--input)',
          border: '1px solid var(--border)',
          borderRadius: 7,
          padding: '6px 10px',
          fontWeight: 600,
          fontSize: 13,
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--text)',
        }}
      >
        <span style={{ color: display ? 'var(--text)' : 'var(--faint)' }}>{display || placeholder}</span>
        <CalendarIcon size={15} className="cy-date-picker-icon" aria-hidden style={{ flex: 'none' }} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose date"
          className="cy-date-picker-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 20,
            width: 'min(280px, 100%)',
            background: 'var(--panel)',
            border: '1px solid var(--border2)',
            borderRadius: 10,
            boxShadow: 'var(--shadow)',
            padding: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
              className="cy-date-picker-nav"
              style={{
                border: '1px solid var(--border)',
                background: 'var(--elev)',
                borderRadius: 6,
                width: 28,
                height: 28,
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                color: 'var(--dim)',
              }}
            >
              <ChevronLeftIcon size={15} />
            </button>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{monthLabel}</span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
              className="cy-date-picker-nav"
              style={{
                border: '1px solid var(--border)',
                background: 'var(--elev)',
                borderRadius: 6,
                width: 28,
                height: 28,
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                color: 'var(--dim)',
              }}
            >
              <ChevronRightIcon size={15} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {WEEKDAYS.map((wd) => (
              <div key={wd} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--faint)', padding: '2px 0' }}>
                {wd}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((cell) => {
              if (!cell.date || cell.day == null) {
                return <div key={cell.key} aria-hidden />
              }
              const isSelected = selected ? sameDay(cell.date, selected) : false
              const isToday = sameDay(cell.date, today)
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => pick(cell.date!)}
                  className="cy-date-picker-day"
                  style={{
                    border: isToday && !isSelected ? '1px solid var(--border2)' : '1px solid transparent',
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    color: isSelected ? 'var(--accent-text)' : 'var(--text)',
                    borderRadius: 7,
                    height: 32,
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
