'use client'
// src/components/listings/InquiryForm.tsx
// Showing request form — submitted by unauthenticated visitors on the public listing detail page.

import { useState, useTransition } from 'react'
import { submitInquiry } from '@/app/actions/inquiries'

interface InquiryFormProps {
  listingId: string
  orgId: string
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
      <div id="inquiry-form" className="cpub-form-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(109,152,102,.15)', display: 'grid', placeItems: 'center', fontSize: 22, color: 'var(--green)' }}>✓</div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Request sent!</h3>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--dim)' }}>
            Your showing request has been sent. We&apos;ll be in touch soon.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div id="inquiry-form" className="cpub-form-card">
      <h2>Request a showing</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="cpub-field">
          <label htmlFor="inq-name">Full name <span style={{ color: 'var(--str-pill)' }}>*</span></label>
          <input id="inq-name" name="name" type="text" required placeholder="Jane Smith" />
        </div>

        <div className="cpub-field">
          <label htmlFor="inq-email">Email address <span style={{ color: 'var(--str-pill)' }}>*</span></label>
          <input id="inq-email" name="email" type="email" required placeholder="jane@example.com" />
        </div>

        <div className="cpub-field">
          <label htmlFor="inq-phone">Phone <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(optional)</span></label>
          <input id="inq-phone" name="phone" type="tel" placeholder="+1 709 555 0100" />
        </div>

        <div className="cpub-field">
          <label htmlFor="inq-move-in">Desired move-in date <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(optional)</span></label>
          <input id="inq-move-in" name="move_in_date" type="date" />
        </div>

        <div className="cpub-field">
          <label htmlFor="inq-budget">Monthly budget ($) <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(optional)</span></label>
          <input id="inq-budget" name="budget" type="number" min={0} step={50} placeholder="2000" />
        </div>

        <div className="cpub-field">
          <label htmlFor="inq-note">Questions or notes <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(optional)</span></label>
          <textarea id="inq-note" name="note" rows={3} placeholder="Anything you'd like us to know…" />
        </div>

        {error && (
          <p style={{ margin: 0, borderRadius: 10, background: 'rgba(255,90,95,.1)', padding: '10px 12px', fontSize: 13, color: 'var(--str-pill)' }} role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={isPending} className="cpub-btn-primary">
          {isPending ? 'Sending…' : 'Send request'}
        </button>
      </form>
    </div>
  )
}
