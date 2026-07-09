'use client'

import React, { useCallback, useState } from 'react'
import DatePickerField from './DatePickerField'
import { createLocalOwnerOccupiedBlock } from '@/lib/canary/owner-occupied-storage'
import type { CanaryOwnerOccupiedBlock, CanaryProperty } from '@/lib/canary/types'

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--input)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '9px 10px',
  marginTop: 4,
}

const labelStyle: React.CSSProperties = {
  fontSize: '11.5px',
  color: 'var(--dim)',
  fontWeight: 600,
}

interface AddOwnerOccupiedModalProps {
  onClose: () => void
  onSaved: (block: CanaryOwnerOccupiedBlock) => void
  properties: CanaryProperty[]
  defaultPropertyId?: string
  userKey?: string
  short: (addr: string | null | undefined) => string
}

export default function AddOwnerOccupiedModal({
  onClose,
  onSaved,
  properties,
  defaultPropertyId,
  userKey,
  short,
}: AddOwnerOccupiedModalProps) {
  const strProps = properties.filter((p) => p.status === 'STR' || p.status === 'Airbnb' || p.status === 'Vacant' || p.status === 'Leased')
  const selectable = strProps.length ? strProps : properties

  const [propertyId, setPropertyId] = useState(defaultPropertyId ?? selectable[0]?.id ?? '')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const submit = useCallback(() => {
    const prop = selectable.find((p) => p.id === propertyId)
    if (!prop) {
      setError('Select a property.')
      return
    }
    if (!start.trim() || !end.trim()) {
      setError('Start and end dates are required.')
      return
    }
    if (end < start) {
      setError('End date must be on or after start date.')
      return
    }
    const block = createLocalOwnerOccupiedBlock(
      {
        property: prop.address,
        propertyId: prop.id,
        start: start.trim(),
        end: end.trim(),
        notes,
      },
      userKey
    )
    onSaved(block)
    onClose()
  }, [selectable, propertyId, start, end, notes, userKey, onSaved, onClose])

  return (
    <>
      <div onClick={onClose} className="cy-modal-backdrop cy-glass-modal-backdrop" style={{ zIndex: 70 }} />
      <div
        className="cy-glass-modal"
        style={{ width: 'min(560px,94vw)', maxHeight: '92vh', padding: 18, zIndex: 71 }}
        role="dialog"
        aria-modal="true"
        aria-label="Add owner stay"
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div className="cy-eyebrow" style={{ marginBottom: 4 }}>Owner occupied</div>
            <div style={{ fontWeight: 700, fontSize: 19 }}>Add owner stay</div>
            <div style={{ color: 'var(--dim)', fontSize: '13px', marginTop: 6, lineHeight: 1.45 }}>
              Blocks STR availability on the timeline. Saved locally until Hospitable sync is wired.
            </div>
          </div>
          <button type="button" className="cy-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          <label>
            <span style={labelStyle}>Property</span>
            <select
              className="cy-select cy-select--field"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              {selectable.map((p) => (
                <option key={p.id} value={p.id}>{short(p.address)} — {p.address}</option>
              ))}
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              <span style={labelStyle}>Check-in</span>
              <DatePickerField value={start} onChange={setStart} placeholder="Start date" />
            </label>
            <label>
              <span style={labelStyle}>Check-out</span>
              <DatePickerField value={end} onChange={setEnd} placeholder="End date" />
            </label>
          </div>
          <label>
            <span style={labelStyle}>Notes <span style={{ color: 'var(--faint)', fontWeight: 500 }}>(optional)</span></span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Owner name, access notes, etc."
              style={{ ...fieldStyle, resize: 'vertical', minHeight: 72 }}
            />
          </label>
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid color-mix(in srgb, var(--amber) 35%, var(--border))',
              background: 'color-mix(in srgb, var(--amber) 8%, var(--panel))',
              color: 'var(--dim)',
              fontSize: 12.5,
              lineHeight: 1.45,
            }}
          >
            After checkout, schedule cleaning from the <strong style={{ color: 'var(--text)' }}>Tasks</strong> view
            or in Hospitable — owner stays can trigger the same turnover tasks as guest checkouts.
          </div>
        </div>

        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" className="cy-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="cy-btn cy-btn--primary" onClick={submit}>Save block</button>
        </div>
      </div>
    </>
  )
}
