'use client'

import React, { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createProperty } from '@/app/actions/properties'
import { CANADIAN_PROVINCES } from '@/lib/constants/provinces'
import type { CanaryPerson, CanaryPortfolio } from '@/lib/canary/types'
import SearchableSelect from './SearchableSelect'

const PROPERTY_TYPES = [
  { value: 'house', label: 'House' },
  { value: 'duplex', label: 'Duplex' },
  { value: 'apartment_building', label: 'Apartment Building' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'other', label: 'Other' },
]

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

interface CanaryAddPropertyModalProps {
  onClose: () => void
  /** After a successful save — open setup wizard for the new unit. */
  onCreated?: (unitId: string) => void
  defaultProvince: string
  owners: CanaryPerson[]
  portfolios: CanaryPortfolio[]
}

export default function CanaryAddPropertyModal({
  onClose,
  onCreated,
  defaultProvince,
  owners,
  portfolios,
}: CanaryAddPropertyModalProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [streetAddress, setStreetAddress] = useState('')
  const [unitNumber, setUnitNumber] = useState('')
  const [city, setCity] = useState('')
  const [province, setProvince] = useState(defaultProvince)
  const [postalCode, setPostalCode] = useState('')
  const [propertyType, setPropertyType] = useState('house')
  const [ownerId, setOwnerId] = useState('')
  const [portfolioId, setPortfolioId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const ownerOptions = owners.filter((p) => p.roles.includes('owner') || p.role === 'Client')

  const submit = useCallback(async () => {
    if (busy) return
    if (!streetAddress.trim() || !city.trim()) {
      setError('Street address and city are required.')
      return
    }
    setBusy(true)
    setError('')
    const res = await createProperty({
      street_address: streetAddress.trim(),
      city: city.trim(),
      province,
      postal_code: postalCode.trim() || undefined,
      property_type: propertyType,
      owner_id: ownerId || null,
      portfolio_id: portfolioId || null,
      unit_number: unitNumber.trim() || null,
    })
    setBusy(false)
    if (!res.success) {
      setError(res.error)
      return
    }
    onClose()
    if (res.unitId) onCreated?.(res.unitId)
    startTransition(() => router.refresh())
  }, [busy, streetAddress, unitNumber, city, province, postalCode, propertyType, ownerId, portfolioId, onClose, onCreated, router])

  return (
    <>
      <div onClick={onClose} className="cy-modal-backdrop cy-glass-modal-backdrop" style={{ zIndex: 70 }} />
      <div
        className="cy-glass-modal"
        style={{ width: 'min(640px,94vw)', maxHeight: '92vh', padding: 18, zIndex: 71 }}
        role="dialog"
        aria-modal="true"
        aria-label="Add property"
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div className="cy-eyebrow" style={{ marginBottom: 4 }}>New property</div>
            <div style={{ fontWeight: 700, fontSize: 19 }}>Add property</div>
            <div style={{ color: 'var(--dim)', fontSize: '13px', marginTop: 6 }}>
              Creates a unit record you can lease, list, or assign to a portfolio.
            </div>
          </div>
          <button type="button" className="cy-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          <label>
            <span style={labelStyle}>Street address</span>
            <input value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} placeholder="18 Smith Ave" style={fieldStyle} />
          </label>
          <label>
            <span style={labelStyle}>Unit letter / number</span>
            <input
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              placeholder="A, B, 1…"
              style={fieldStyle}
            />
            <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: 'var(--faint)' }}>
              Optional. Use A/B for a duplex unit. Leave blank for a whole building.
            </span>
          </label>
          <label>
            <span style={labelStyle}>City</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="St. John's" style={fieldStyle} />
          </label>
          <label>
            <span style={labelStyle}>Province</span>
            <select className="cy-select cy-select--field" value={province} onChange={(e) => setProvince(e.target.value)}>
              {CANADIAN_PROVINCES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span style={labelStyle}>Postal code</span>
            <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="A1B 2C3" style={fieldStyle} />
          </label>
          <label>
            <span style={labelStyle}>Property type</span>
            <select className="cy-select cy-select--field" value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          {ownerOptions.length > 0 && (
            <label>
              <span style={labelStyle}>Owner</span>
              <SearchableSelect
                value={ownerId}
                onChange={setOwnerId}
                placeholder="— No owner —"
                searchPlaceholder="Search owners…"
                aria-label="Owner"
                options={[
                  { value: '', label: '— No owner —' },
                  ...ownerOptions.map((o) => ({
                    value: o.id,
                    label: o.name,
                    searchText: `${o.name} ${o.email} ${o.company}`,
                  })),
                ]}
              />
            </label>
          )}
          {portfolios.length > 0 && (
            <label>
              <span style={labelStyle}>Portfolio</span>
              <SearchableSelect
                value={portfolioId}
                onChange={setPortfolioId}
                placeholder="— No portfolio —"
                searchPlaceholder="Search portfolios…"
                aria-label="Portfolio"
                options={[
                  { value: '', label: '— No portfolio —' },
                  ...portfolios.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </label>
          )}
        </div>

        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'end', gap: 10, marginTop: 18 }}>
          <button type="button" className="cy-btn" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="cy-btn-primary cy-accent-btn"
            onClick={submit}
            disabled={busy}
            style={{ opacity: busy ? 0.6 : 1 }}
          >
            {busy ? 'Creating…' : 'Create property'}
          </button>
        </div>
      </div>
    </>
  )
}
