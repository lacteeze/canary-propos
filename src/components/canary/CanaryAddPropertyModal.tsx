'use client'

import React, { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createProperty } from '@/app/actions/properties'
import { CANADIAN_PROVINCES } from '@/lib/constants/provinces'
import type { CanaryPerson, CanaryPortfolio } from '@/lib/canary/types'

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
  defaultProvince: string
  owners: CanaryPerson[]
  portfolios: CanaryPortfolio[]
}

export default function CanaryAddPropertyModal({
  onClose,
  defaultProvince,
  owners,
  portfolios,
}: CanaryAddPropertyModalProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [streetAddress, setStreetAddress] = useState('')
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
    })
    setBusy(false)
    if (!res.success) {
      setError(res.error)
      return
    }
    onClose()
    startTransition(() => router.refresh())
  }, [busy, streetAddress, city, province, postalCode, propertyType, ownerId, portfolioId, onClose, router])

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
          <label style={{ gridColumn: '1 / -1' }}>
            <span style={labelStyle}>Street address</span>
            <input value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} placeholder="123 Main St" style={fieldStyle} />
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
              <select className="cy-select cy-select--field" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">— No owner —</option>
                {ownerOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </label>
          )}
          {portfolios.length > 0 && (
            <label>
              <span style={labelStyle}>Portfolio</span>
              <select className="cy-select cy-select--field" value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)}>
                <option value="">— No portfolio —</option>
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
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
