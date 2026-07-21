// src/components/settings/OrgSettingsForm.tsx
// Org settings form — name, logo (stub), province — Canary shell styling
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CANADIAN_PROVINCES } from '@/lib/constants/provinces'
import { updateOrgProfile } from '@/app/(manager)/settings/actions'

interface OrgSettingsFormProps {
  orgId: string
  initialName: string
  initialProvince: string
  initialLogoPath: string | null
}

export function OrgSettingsForm({
  initialName,
  initialProvince,
}: OrgSettingsFormProps) {
  const [name, setName] = useState(initialName)
  const [province, setProvince] = useState(initialProvince)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updateOrgProfile({ name, province })
      if (result.success) {
        toast.success('Changes saved')
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="cy-settings-stack">
      <section className="cy-section-card cy-settings-card">
        <h2 className="cy-section-title">Organization name</h2>
        <label htmlFor="settings-name" className="cy-label">
          Name
        </label>
        <input
          id="settings-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={80}
          placeholder="e.g. Canary Property Management"
          className="cy-input"
        />
        <div className="cy-settings-actions">
          <button type="submit" disabled={isPending} className="cy-btn cy-btn--active">
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </section>

      <section className="cy-section-card cy-settings-card">
        <h2 className="cy-section-title">Logo</h2>
        <div className="cy-settings-logo-row">
          <div className="cy-settings-logo-stub" aria-hidden>
            Upload logo
          </div>
          <p className="cy-settings-help">
            Logo upload will be available soon. Your logo appears on tenant portals and email
            communications.
          </p>
        </div>
      </section>

      <section className="cy-section-card cy-settings-card">
        <h2 className="cy-section-title">Province or Territory</h2>
        <label htmlFor="settings-province" className="cy-label">
          Where do you operate?
        </label>
        <select
          id="settings-province"
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          required
          className="cy-input"
        >
          <option value="" disabled>
            Select province or territory
          </option>
          {CANADIAN_PROVINCES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <div className="cy-settings-actions">
          <button type="submit" disabled={isPending} className="cy-btn cy-btn--active">
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </section>

      <section className="cy-section-card cy-settings-card">
        <h2 className="cy-section-title">
          Branding color <span className="cy-settings-soon">Coming soon</span>
        </h2>
        <label htmlFor="settings-brand-color" className="cy-label">
          Brand color
        </label>
        <input
          id="settings-brand-color"
          type="text"
          disabled
          placeholder="#D97706"
          className="cy-input"
        />
      </section>

      {error && (
        <p className="cy-settings-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
