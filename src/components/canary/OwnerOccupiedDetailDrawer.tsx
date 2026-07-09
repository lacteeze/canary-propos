'use client'

import React from 'react'
import type { CanaryOwnerOccupiedBlock } from '@/lib/canary/types'

interface OwnerOccupiedDetailDrawerProps {
  block: CanaryOwnerOccupiedBlock | null
  onClose: () => void
  short: (addr: string | null | undefined) => string
  onDeleteLocal?: (id: string) => void
  onOpenProperty?: (propertyId: string) => void
}

function fmtRange(start: string, end: string): string {
  const fmt = (s: string) => {
    const d = new Date(s + 'T12:00:00')
    return Number.isNaN(d.getTime())
      ? s
      : d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  return `${fmt(start)} → ${fmt(end)}`
}

export default function OwnerOccupiedDetailDrawer({
  block,
  onClose,
  short,
  onDeleteLocal,
  onOpenProperty,
}: OwnerOccupiedDetailDrawerProps) {
  React.useEffect(() => {
    if (!block) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [block, onClose])

  if (!block) return null

  const isLocal = block.source === 'local'
  const sourceLabel = isLocal ? 'Canary (local — not synced to Hospitable)' : 'Hospitable owner stay'

  return (
    <>
      <div onClick={onClose} className="cy-modal-backdrop cy-task-modal-backdrop" aria-hidden="true" />
      <div className="cy-task-modal" role="dialog" aria-modal="true" aria-label="Owner stay details">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <div>
            <div className="cy-eyebrow" style={{ marginBottom: 4 }}>Owner occupied</div>
            <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-.02em', color: 'var(--amber-text)' }}>
              Owner stay
            </div>
            <div style={{ color: 'var(--dim)', fontSize: 13, marginTop: 6 }}>{sourceLabel}</div>
          </div>
          <button type="button" className="cy-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={{ flex: 1, paddingBottom: 12 }}>
          <div className="cy-drawer-section-title">Property</div>
          <button
            type="button"
            className="cy-task-property-card cy-hov-border"
            onClick={() => block.propertyId && onOpenProperty?.(block.propertyId)}
            disabled={!block.propertyId || !onOpenProperty}
            style={{ width: '100%', textAlign: 'left', marginBottom: 14 }}
          >
            <div style={{ fontWeight: 650 }}>{short(block.property)}</div>
            <div style={{ color: 'var(--dim)', fontSize: 12.5, marginTop: 2 }}>{block.property}</div>
          </button>

          <div className="cy-drawer-row">
            <span className="cy-drawer-row-label">Dates</span>
            <span className="cy-drawer-row-value">{fmtRange(block.start, block.end)}</span>
          </div>
          {block.guestLabel && (
            <div className="cy-drawer-row">
              <span className="cy-drawer-row-label">Guest label</span>
              <span className="cy-drawer-row-value">{block.guestLabel}</span>
            </div>
          )}
          {block.notes && (
            <div style={{ marginTop: 14 }}>
              <div className="cy-drawer-section-title">Notes</div>
              <div style={{ color: 'var(--text)', fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{block.notes}</div>
            </div>
          )}

          <div
            style={{
              marginTop: 16,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--elev)',
              color: 'var(--dim)',
              fontSize: 12.5,
              lineHeight: 1.45,
            }}
          >
            Turnover cleaning can be scheduled from the Tasks view after checkout, or via Hospitable automations scoped to manual / owner stays.
          </div>
        </div>

        {isLocal && onDeleteLocal && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <button
              type="button"
              className="cy-btn"
              style={{ color: 'var(--red)', borderColor: 'color-mix(in srgb, var(--red) 40%, var(--border))' }}
              onClick={() => {
                onDeleteLocal(block.id)
                onClose()
              }}
            >
              Remove local block
            </button>
          </div>
        )}
      </div>
    </>
  )
}
