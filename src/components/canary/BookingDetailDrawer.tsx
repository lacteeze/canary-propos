'use client'

import React from 'react'
import type { CanaryStrBooking } from '@/lib/canary/types'
import {
  bookingSourceLine,
  bookingStatusColor,
  bookingStatusLabel,
  formatBookingCheckInRelative,
  formatBookingDateRange,
  formatBookingDateTime,
} from '@/lib/canary/booking-detail'

interface BookingDetailDrawerProps {
  booking: CanaryStrBooking | null
  onClose: () => void
  short: (addr: string | null | undefined) => string
  onOpenProperty?: (address: string) => void
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="cy-drawer-section-title">{children}</div>
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="cy-drawer-row">
      <span className="cy-drawer-row-label">{label}</span>
      <span className="cy-drawer-row-value">{value}</span>
    </div>
  )
}

export default function BookingDetailDrawer({ booking, onClose, short, onOpenProperty }: BookingDetailDrawerProps) {
  React.useEffect(() => {
    if (!booking) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [booking, onClose])

  if (!booking) return null

  const source = bookingSourceLine(booking)
  const relativeCheckIn = formatBookingCheckInRelative(booking)
  const statusLabel = bookingStatusLabel(booking.status)
  const statusColor = bookingStatusColor(booking.status)
  const hasSchedule = !!(booking.checkInAt?.trim() || booking.checkOutAt?.trim() || booking.start || booking.end)

  return (
    <>
      <div onClick={onClose} className="cy-modal-backdrop cy-task-modal-backdrop" aria-hidden="true" />
      <div className="cy-task-modal" role="dialog" aria-modal="true" aria-label="Booking details">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <div>
            <div className="cy-eyebrow" style={{ marginBottom: 4 }}>Booking details</div>
            <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-.02em', color: 'var(--blue)' }}>
              {booking.guestLabel}
            </div>
            {source && (
              <div style={{ color: 'var(--dim)', fontSize: 13, marginTop: 6, lineHeight: 1.45 }}>{source}</div>
            )}
            {relativeCheckIn && (
              <div style={{ color: 'var(--text)', fontSize: 13, marginTop: 8, fontWeight: 600 }}>{relativeCheckIn}</div>
            )}
          </div>
          <button type="button" className="cy-btn" onClick={onClose} aria-label="Close booking details">✕</button>
        </div>

        <div style={{ flex: 1, paddingBottom: 12 }}>
          {/* Property */}
          <div style={{ marginTop: 14 }}>
            <SectionTitle>Property</SectionTitle>
            <button
              type="button"
              className="cy-task-property-card cy-hov-border"
              onClick={() => onOpenProperty?.(booking.property)}
              disabled={!onOpenProperty}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--elev)',
                cursor: onOpenProperty ? 'pointer' : 'default',
              }}
            >
              <div
                aria-hidden
                style={{
                  flex: 'none',
                  width: 52,
                  height: 52,
                  borderRadius: 10,
                  background: 'color-mix(in srgb, var(--blue) 22%, var(--panel))',
                  border: '1px solid color-mix(in srgb, var(--blue) 35%, var(--border))',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: 15,
                  color: 'var(--blue)',
                }}
              >
                {short(booking.property).slice(0, 2).toUpperCase() || '—'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 650, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {short(booking.property)}
                </div>
                <div style={{ color: 'var(--dim)', fontSize: 12.5, marginTop: 2, lineHeight: 1.35 }}>{booking.property}</div>
                {booking.hospitablePropertyName && booking.hospitablePropertyName !== booking.property && (
                  <div style={{ color: 'var(--faint)', fontSize: 11.5, marginTop: 4 }}>{booking.hospitablePropertyName}</div>
                )}
              </div>
            </button>
          </div>

          {/* Stay */}
          {hasSchedule && (
            <div style={{ marginTop: 14 }}>
              <SectionTitle>Stay</SectionTitle>
              {booking.checkInAt?.trim() ? (
                <FieldRow label="Check-in" value={formatBookingDateTime(booking.checkInAt)} />
              ) : booking.start ? (
                <FieldRow label="Check-in" value={booking.start} />
              ) : null}
              {booking.checkOutAt?.trim() ? (
                <FieldRow label="Check-out" value={formatBookingDateTime(booking.checkOutAt)} />
              ) : booking.end ? (
                <FieldRow label="Check-out" value={booking.end} />
              ) : null}
              {booking.nights != null && booking.nights > 0 ? (
                <FieldRow label="Nights" value={String(booking.nights)} />
              ) : null}
              <FieldRow label="Date range" value={formatBookingDateRange(booking.start, booking.end)} />
            </div>
          )}

          {/* Reservation */}
          <div style={{ marginTop: 14 }}>
            <SectionTitle>Reservation</SectionTitle>
            {booking.code?.trim() ? <FieldRow label="Code" value={booking.code} /> : null}
            {booking.platform ? <FieldRow label="Platform" value={booking.platform} /> : null}
            <FieldRow label="Guest" value={booking.guestLabel} />
          </div>

          {/* Status */}
          <div style={{ marginTop: 14 }}>
            <SectionTitle>Status</SectionTitle>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 99,
                  background: `color-mix(in srgb, ${statusColor} 12%, var(--elev))`,
                  border: `1px solid color-mix(in srgb, ${statusColor} 35%, var(--border))`,
                  color: statusColor,
                }}
              >
                {statusLabel}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
            marginTop: 'auto',
          }}
        >
          <button type="button" className="cy-btn-primary cy-accent-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  )
}
