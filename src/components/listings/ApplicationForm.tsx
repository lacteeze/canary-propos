'use client'
// src/components/listings/ApplicationForm.tsx
// Application interest form — submitted by unauthenticated visitors on the public listing detail page.

import { useState, useTransition } from 'react'
import { submitApplication } from '@/app/actions/inquiries'

interface ApplicationFormProps {
  listingId: string
  orgId: string
}

export function ApplicationForm({ listingId, orgId }: ApplicationFormProps) {
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('listing_id', listingId)
    formData.set('org_id', orgId)

    startTransition(async () => {
      const result = await submitApplication(formData)
      if (result.success) {
        setSuccess(true)
      } else {
        setError(result.error)
      }
    })
  }

  if (success) {
    return (
      <div id="apply-form" className="cpub-form-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(109,152,102,.15)', display: 'grid', placeItems: 'center', fontSize: 22, color: 'var(--green)' }}>✓</div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Application received!</h3>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--dim)' }}>
            Thank you for your interest. We&apos;ll review your application and reach out shortly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div id="apply-form" className="cpub-form-card">
      <h2>Apply for this unit</h2>
      <p className="cpub-form-sub">Express your interest — we&apos;ll be in touch to walk you through next steps.</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="cpub-field">
          <label htmlFor="app-name">Full name <span style={{ color: 'var(--str-pill)' }}>*</span></label>
          <input id="app-name" name="name" type="text" required placeholder="Jane Smith" />
        </div>

        <div className="cpub-field">
          <label htmlFor="app-email">Email address <span style={{ color: 'var(--str-pill)' }}>*</span></label>
          <input id="app-email" name="email" type="email" required placeholder="jane@example.com" />
        </div>

        <div className="cpub-field">
          <label htmlFor="app-phone">Phone <span style={{ color: 'var(--str-pill)' }}>*</span></label>
          <input id="app-phone" name="phone" type="tel" required placeholder="+1 709 555 0100" />
        </div>

        <div className="cpub-field">
          <label htmlFor="app-move-in">Desired move-in date <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(optional)</span></label>
          <input id="app-move-in" name="move_in_date" type="date" />
        </div>

        <div className="cpub-field">
          <label htmlFor="app-note">Tell us about yourself <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(optional)</span></label>
          <textarea
            id="app-note"
            name="note"
            rows={4}
            placeholder="A little about you, your household, pets, or anything else that would help us understand your situation…"
          />
        </div>

        {error && (
          <p style={{ margin: 0, borderRadius: 10, background: 'rgba(255,90,95,.1)', padding: '10px 12px', fontSize: 13, color: 'var(--str-pill)' }} role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={isPending} className="cpub-btn-primary">
          {isPending ? 'Submitting…' : 'Submit application interest'}
        </button>
      </form>
    </div>
  )
}
