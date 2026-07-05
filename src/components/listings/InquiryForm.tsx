'use client'
// src/components/listings/InquiryForm.tsx
// Showing request form — submitted by unauthenticated visitors on the public listing detail page.
// Fields: name, email, phone, move_in_date, budget, note.

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
      <div id="inquiry-form" className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-stone-900">Request sent!</h3>
          <p className="text-sm text-stone-600">
            Your showing request has been sent. We&apos;ll be in touch soon.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div id="inquiry-form" className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-stone-900">Request a showing</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="inq-name" className="mb-1 block text-sm font-medium text-stone-700">
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            id="inq-name"
            name="name"
            type="text"
            required
            placeholder="Jane Smith"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="inq-email" className="mb-1 block text-sm font-medium text-stone-700">
            Email address <span className="text-red-500">*</span>
          </label>
          <input
            id="inq-email"
            name="email"
            type="email"
            required
            placeholder="jane@example.com"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="inq-phone" className="mb-1 block text-sm font-medium text-stone-700">
            Phone <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <input
            id="inq-phone"
            name="phone"
            type="tel"
            placeholder="+1 416 555 0100"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Move-in date */}
        <div>
          <label htmlFor="inq-move-in" className="mb-1 block text-sm font-medium text-stone-700">
            Desired move-in date <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <input
            id="inq-move-in"
            name="move_in_date"
            type="date"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Budget */}
        <div>
          <label htmlFor="inq-budget" className="mb-1 block text-sm font-medium text-stone-700">
            Monthly budget ($) <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <input
            id="inq-budget"
            name="budget"
            type="number"
            min={0}
            step={50}
            placeholder="2000"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Note */}
        <div>
          <label htmlFor="inq-note" className="mb-1 block text-sm font-medium text-stone-700">
            Questions or notes <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="inq-note"
            name="note"
            rows={3}
            placeholder="Anything you'd like us to know…"
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
          className="flex min-h-11 w-full items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {isPending ? 'Sending…' : 'Send request'}
        </button>
      </form>
    </div>
  )
}
