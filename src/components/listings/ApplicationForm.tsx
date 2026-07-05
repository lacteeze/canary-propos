'use client'
// src/components/listings/ApplicationForm.tsx
// Application interest form — submitted by unauthenticated visitors on the public listing detail page.
// Phase 3 scope: interest capture only (name, email, phone required, move_in_date, note).
// Full tenant screening (Single Key / Plaid) is deferred to Phase 4 (D-08).

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
      <div id="apply-form" className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-stone-900">Application received!</h3>
          <p className="text-sm text-stone-600">
            Thank you for your interest. We&apos;ll review your application and reach out shortly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div id="apply-form" className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-xl font-semibold text-stone-900">Apply for this unit</h2>
      <p className="mb-4 text-sm text-stone-500">
        Express your interest — we&apos;ll be in touch to walk you through next steps.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="app-name" className="mb-1 block text-sm font-medium text-stone-700">
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            id="app-name"
            name="name"
            type="text"
            required
            placeholder="Jane Smith"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="app-email" className="mb-1 block text-sm font-medium text-stone-700">
            Email address <span className="text-red-500">*</span>
          </label>
          <input
            id="app-email"
            name="email"
            type="email"
            required
            placeholder="jane@example.com"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Phone — required for applications (D-09) */}
        <div>
          <label htmlFor="app-phone" className="mb-1 block text-sm font-medium text-stone-700">
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            id="app-phone"
            name="phone"
            type="tel"
            required
            placeholder="+1 416 555 0100"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Move-in date */}
        <div>
          <label htmlFor="app-move-in" className="mb-1 block text-sm font-medium text-stone-700">
            Desired move-in date <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <input
            id="app-move-in"
            name="move_in_date"
            type="date"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Note */}
        <div>
          <label htmlFor="app-note" className="mb-1 block text-sm font-medium text-stone-700">
            Tell us about yourself <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="app-note"
            name="note"
            rows={4}
            placeholder="A little about you, your household, pets, or anything else that would help us understand your situation…"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          />
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="flex min-h-11 w-full items-center justify-center rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60"
        >
          {isPending ? 'Submitting…' : 'Submit application interest'}
        </button>
      </form>
    </div>
  )
}
