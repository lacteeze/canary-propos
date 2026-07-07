'use client'
// src/components/listings/InquiryForm.tsx
// Showing request form — submitted by unauthenticated visitors on the public listing detail page.
// Fields: name, email, phone, move_in_date, budget, note.
// Styled to match the landing page branding (see public-theme.css / .cpub scope).

import { useState, useTransition } from 'react'
import { submitInquiry } from '@/app/actions/inquiries'

interface InquiryFormProps {
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

export function InquiryForm({ listingId, orgId }: InquiryFormProps) {
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
      const result = await submitInquiry(formData)
      if (result.success) {
        setSuccess(true)
      } else {
        setError(result.error)
      }
    })
  }

  if (success) {
    return (
      <div id="inquiry-form" style={cardStyle}>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: 'rgba(109,152,102,.18)', color: 'var(--green)', fontSize: 22, fontWeight: 700 }}
          >
            ✓
          </div>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Request sent!</h3>
          <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--dim)', maxWidth: '32ch' }}>
            Your showing request has been sent. We&apos;ll be in touch soon.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div id="inquiry-form" style={cardStyle}>
      <h2 style={{ margin: '0 0 4px', fontSize: 21, fontWeight: 700, letterSpacing: '-.02em' }}>Request a showing</h2>
      <p style={{ margin: '0 0 18px', fontSize: '13.5px', color: 'var(--dim)' }}>
        Tell us when works for you — we&apos;ll confirm within a business day.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="inq-name" style={labelStyle}>
            Full name <span style={{ color: 'var(--red)' }}>*</span>
          </label>
          <input
            id="inq-name"
            name="name"
            type="text"
            required
            placeholder="Jane Smith"
            className="cpub-field"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="inq-email" style={labelStyle}>
            Email address <span style={{ color: 'var(--red)' }}>*</span>
          </label>
          <input
            id="inq-email"
            name="email"
            type="email"
            required
            placeholder="jane@example.com"
            className="cpub-field"
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="inq-phone" style={labelStyle}>
            Phone <span style={optionalStyle}>(optional)</span>
          </label>
          <input
            id="inq-phone"
            name="phone"
            type="tel"
            placeholder="+1 416 555 0100"
            className="cpub-field"
          />
        </div>

        {/* Move-in date */}
        <div>
          <label htmlFor="inq-move-in" style={labelStyle}>
            Desired move-in date <span style={optionalStyle}>(optional)</span>
          </label>
          <input id="inq-move-in" name="move_in_date" type="date" className="cpub-field" />
        </div>

        {/* Budget */}
        <div>
          <label htmlFor="inq-budget" style={labelStyle}>
            Monthly budget ($) <span style={optionalStyle}>(optional)</span>
          </label>
          <input
            id="inq-budget"
            name="budget"
            type="number"
            min={0}
            step={50}
            placeholder="2000"
            className="cpub-field"
          />
        </div>

        {/* Note */}
        <div>
          <label htmlFor="inq-note" style={labelStyle}>
            Questions or notes <span style={optionalStyle}>(optional)</span>
          </label>
          <textarea
            id="inq-note"
            name="note"
            rows={3}
            placeholder="Anything you'd like us to know…"
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
          className="cpub-btn-yellow flex min-h-12 w-full items-center justify-center disabled:opacity-60"
          style={{ padding: '12px 22px', fontSize: '15px' }}
        >
          {isPending ? 'Sending…' : 'Send request'}
        </button>
      </form>
    </div>
  )
}
