'use client'
// src/components/listings/ApplicationForm.tsx
// Application interest form — submitted by unauthenticated visitors on the public listing detail page.
// Phase 3 scope: interest capture only (name, email, phone required, move_in_date, note).
// Full tenant screening (Single Key / Plaid) is deferred to Phase 4 (D-08).
// Styled to match the landing page branding (see public-theme.css / .cpub scope).

import { useState, useTransition } from 'react'
import { submitApplication } from '@/app/actions/inquiries'

interface ApplicationFormProps {
  listingId: string
  orgId: string
}

const cardStyle: React.CSSProperties = {
  background: 'var(--elev)',
  border: '1px solid var(--border)',
  borderRadius: 22,
  padding: '26px 26px 24px',
  boxShadow: 'var(--shadow)',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--text)',
}

const optionalStyle: React.CSSProperties = {
  color: 'var(--faint)',
  fontWeight: 400,
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
      <div id="apply-form" style={cardStyle}>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: 'rgba(109,152,102,.18)', color: 'var(--green)', fontSize: 22, fontWeight: 700 }}
          >
            ✓
          </div>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Application received!</h3>
          <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--dim)', maxWidth: '36ch' }}>
            Thank you for your interest. We&apos;ll review your application and reach out shortly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div id="apply-form" style={cardStyle}>
      <h2 style={{ margin: '0 0 4px', fontSize: 21, fontWeight: 700, letterSpacing: '-.02em' }}>Apply for this unit</h2>
      <p style={{ margin: '0 0 18px', fontSize: '13.5px', color: 'var(--dim)' }}>
        Express your interest — we&apos;ll be in touch to walk you through next steps.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="app-name" style={labelStyle}>
            Full name <span style={{ color: 'var(--red)' }}>*</span>
          </label>
          <input
            id="app-name"
            name="name"
            type="text"
            required
            placeholder="Jane Smith"
            className="cpub-field"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="app-email" style={labelStyle}>
            Email address <span style={{ color: 'var(--red)' }}>*</span>
          </label>
          <input
            id="app-email"
            name="email"
            type="email"
            required
            placeholder="jane@example.com"
            className="cpub-field"
          />
        </div>

        {/* Phone — required for applications (D-09) */}
        <div>
          <label htmlFor="app-phone" style={labelStyle}>
            Phone <span style={{ color: 'var(--red)' }}>*</span>
          </label>
          <input
            id="app-phone"
            name="phone"
            type="tel"
            required
            placeholder="+1 416 555 0100"
            className="cpub-field"
          />
        </div>

        {/* Move-in date */}
        <div>
          <label htmlFor="app-move-in" style={labelStyle}>
            Desired move-in date <span style={optionalStyle}>(optional)</span>
          </label>
          <input id="app-move-in" name="move_in_date" type="date" className="cpub-field" />
        </div>

        {/* Note */}
        <div>
          <label htmlFor="app-note" style={labelStyle}>
            Tell us about yourself <span style={optionalStyle}>(optional)</span>
          </label>
          <textarea
            id="app-note"
            name="note"
            rows={4}
            placeholder="A little about you, your household, pets, or anything else that would help us understand your situation…"
            className="cpub-field resize-none"
          />
        </div>

        {error && (
          <p
            role="alert"
            style={{ margin: 0, borderRadius: 12, background: 'rgba(179,86,74,.12)', border: '1px solid rgba(179,86,74,.3)', padding: '10px 14px', fontSize: '13.5px', color: 'var(--red)' }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="flex min-h-12 w-full items-center justify-center disabled:opacity-60"
          style={{ border: 'none', background: 'var(--ink)', color: 'var(--ink-text)', borderRadius: 999, padding: '12px 22px', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}
        >
          {isPending ? 'Submitting…' : 'Submit application interest'}
        </button>
      </form>
    </div>
  )
}
