'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createOnboardingContact } from '@/app/actions/property-onboarding'

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

type PersonRole = 'owner' | 'tenant'

export default function CanaryAddPersonModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<PersonRole>('owner')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (busy) return
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    setBusy(true)
    setError('')
    const res = await createOnboardingContact({
      role,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
    })
    setBusy(false)
    if (!res.success) {
      setError(res.error)
      return
    }
    onClose()
    router.refresh()
  }

  return (
    <>
      <div onClick={onClose} className="cy-modal-backdrop cy-glass-modal-backdrop" style={{ zIndex: 70 }} />
      <div
        className="cy-glass-modal"
        style={{ width: 'min(480px,94vw)', maxHeight: '92vh', padding: 18, zIndex: 71 }}
        role="dialog"
        aria-modal="true"
        aria-label="Add person"
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div className="cy-eyebrow" style={{ marginBottom: 4 }}>People</div>
            <div style={{ fontWeight: 700, fontSize: 19 }}>Add person</div>
            <div style={{ color: 'var(--dim)', fontSize: 13, marginTop: 6 }}>
              Creates an owner or tenant you can assign to properties and leases.
            </div>
          </div>
          <button type="button" className="cy-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <label>
            <span style={labelStyle}>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Beth Whalen" style={fieldStyle} autoComplete="name" />
          </label>
          <label>
            <span style={labelStyle}>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="beth@example.com" style={fieldStyle} autoComplete="email" />
          </label>
          <label>
            <span style={labelStyle}>Phone</span>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="709-555-0100" style={fieldStyle} autoComplete="tel" />
          </label>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ ...labelStyle, marginBottom: 6 }}>Role</legend>
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <input type="radio" name="person-role" checked={role === 'owner'} onChange={() => setRole('owner')} />
                Owner / client
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <input type="radio" name="person-role" checked={role === 'tenant'} onChange={() => setRole('tenant')} />
                Tenant
              </label>
            </div>
          </fieldset>
        </div>

        {error ? <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{error}</div> : null}

        <div style={{ display: 'flex', justifyContent: 'end', gap: 10, marginTop: 18 }}>
          <button type="button" className="cy-btn" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="cy-btn-primary cy-accent-btn"
            onClick={() => void save()}
            disabled={busy}
            style={{ opacity: busy ? 0.6 : 1 }}
          >
            {busy ? 'Saving…' : 'Save person'}
          </button>
        </div>
      </div>
    </>
  )
}
