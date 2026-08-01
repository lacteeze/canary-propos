'use client'
// General “what I’m looking for” interest form — shown on published listings and leased property pages.

import { useState, useTransition } from 'react'
import { submitGeneralInterest } from '@/app/actions/inquiries'

export interface InterestFormProps {
  orgId: string
  /** When submitted from a published listing page */
  listingId?: string | null
  /** When submitted from a property (incl. leased) page */
  propertyId?: string | null
  /** Display/context for notes + emails when there is no listing title */
  propertyLabel?: string | null
  propertySlug?: string | null
}

export function InterestForm({
  orgId,
  listingId,
  propertyId,
  propertyLabel,
  propertySlug,
}: InterestFormProps) {
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('org_id', orgId)
    if (listingId) formData.set('listing_id', listingId)
    if (propertyId) formData.set('property_id', propertyId)
    if (propertyLabel) formData.set('property_label', propertyLabel)
    if (propertySlug) formData.set('property_slug', propertySlug)

    startTransition(async () => {
      const result = await submitGeneralInterest(formData)
      if (result.success) {
        setSuccess(true)
      } else {
        setError(result.error)
      }
    })
  }

  if (success) {
    return (
      <div id="interest-form" className="cpub-form-card cpub-form-card--column">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            padding: '16px 0',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(109,152,102,.15)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 22,
              color: 'var(--green)',
            }}
          >
            ✓
          </div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>You&apos;re on our list!</h3>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--dim)' }}>
            Thanks — we&apos;ll reach out when something matches what you&apos;re looking for.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div id="interest-form" className="cpub-form-card cpub-form-card--column">
      <h2>Tell us what you&apos;re looking for</h2>
      <p className="cpub-form-sub">
        Get on our list — share your must-haves and we&apos;ll match you with upcoming homes.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="cpub-field">
          <label htmlFor="int-name">
            Full name <span style={{ color: 'var(--str-pill)' }}>*</span>
          </label>
          <input id="int-name" name="name" type="text" required placeholder="Jane Smith" />
        </div>

        <div className="cpub-field">
          <label htmlFor="int-email">
            Email address <span style={{ color: 'var(--str-pill)' }}>*</span>
          </label>
          <input id="int-email" name="email" type="email" required placeholder="jane@example.com" />
        </div>

        <div className="cpub-field">
          <label htmlFor="int-phone">
            Phone <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(optional)</span>
          </label>
          <input id="int-phone" name="phone" type="tel" placeholder="+1 709 555 0100" />
        </div>

        <div className="cpub-form-row">
          <div className="cpub-field">
            <label htmlFor="int-beds">
              Bedrooms <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(optional)</span>
            </label>
            <select id="int-beds" name="beds" defaultValue="">
              <option value="">Any</option>
              <option value="1">1+</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
            </select>
          </div>

          <div className="cpub-field">
            <label htmlFor="int-budget">
              Monthly budget ($){' '}
              <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(optional)</span>
            </label>
            <input id="int-budget" name="budget" type="number" min={0} step={50} placeholder="2000" />
          </div>
        </div>

        <div className="cpub-field">
          <label htmlFor="int-move-in">
            Desired move-in{' '}
            <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(optional)</span>
          </label>
          <input id="int-move-in" name="move_in_date" type="date" />
        </div>

        <div className="cpub-form-row">
          <div className="cpub-field">
            <label htmlFor="int-pets">
              Pets <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(optional)</span>
            </label>
            <select id="int-pets" name="pets" defaultValue="">
              <option value="">No preference</option>
              <option value="No pets">No pets</option>
              <option value="Cat(s)">Cat(s)</option>
              <option value="Dog(s)">Dog(s)</option>
              <option value="Cats and dogs">Cats and dogs</option>
              <option value="Other pets">Other pets</option>
            </select>
          </div>

          <div className="cpub-field">
            <label htmlFor="int-garage">
              Garage / parking{' '}
              <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(optional)</span>
            </label>
            <select id="int-garage" name="garage" defaultValue="">
              <option value="">No preference</option>
              <option value="Not needed">Not needed</option>
              <option value="Street / driveway ok">Street / driveway ok</option>
              <option value="Garage preferred">Garage preferred</option>
              <option value="Garage required">Garage required</option>
            </select>
          </div>
        </div>

        <div className="cpub-field">
          <label htmlFor="int-area">
            Preferred area{' '}
            <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(optional)</span>
          </label>
          <input
            id="int-area"
            name="preferred_area"
            type="text"
            placeholder="e.g. East end, downtown, Mount Pearl"
          />
        </div>

        <div className="cpub-field">
          <label htmlFor="int-note">
            More about what you&apos;re looking for{' '}
            <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(optional)</span>
          </label>
          <textarea
            id="int-note"
            name="note"
            rows={4}
            placeholder="Must-haves, timing flexibility, household size, or anything else that helps us match you…"
          />
        </div>

        {error && (
          <p
            style={{
              margin: 0,
              borderRadius: 10,
              background: 'rgba(255,90,95,.1)',
              padding: '10px 12px',
              fontSize: 13,
              color: 'var(--str-pill)',
            }}
            role="alert"
          >
            {error}
          </p>
        )}

        <button type="submit" disabled={isPending} className="cpub-btn-primary">
          {isPending ? 'Sending…' : 'Get on our list'}
        </button>
      </form>
    </div>
  )
}
