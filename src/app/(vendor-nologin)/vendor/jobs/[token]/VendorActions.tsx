'use client'

// src/app/(vendor-nologin)/vendor/jobs/[token]/VendorActions.tsx
// Client component for vendor status-update buttons on the no-login page.
// Calls updateViaVendorToken server action via useTransition.

import { useState, useTransition } from 'react'
import { updateViaVendorToken } from '@/app/actions/work-orders'

interface VendorActionsProps {
  token: string
  status: string
}

export function VendorActions({ token, status }: VendorActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [invoiceAmount, setInvoiceAmount] = useState('')

  function handleStartWork() {
    setError('')
    startTransition(async () => {
      const result = await updateViaVendorToken(token, 'in_progress')
      if (!result.success) {
        setError(result.error)
      } else {
        setMessage('Status updated to In Progress. Canary Property Management has been notified.')
      }
    })
  }

  function handleMarkComplete(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const amountNum = invoiceAmount ? parseFloat(invoiceAmount) : undefined
    if (invoiceAmount && (isNaN(amountNum!) || amountNum! < 0)) {
      setError('Please enter a valid invoice amount.')
      return
    }
    startTransition(async () => {
      const result = await updateViaVendorToken(token, 'completed', amountNum)
      if (!result.success) {
        setError(result.error)
      } else {
        setMessage('Work order submitted as complete. Canary Property Management has been notified.')
      }
    })
  }

  if (message) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 p-4">
        <p className="text-sm font-medium text-green-800">{message}</p>
      </div>
    )
  }

  if (status === 'assigned') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-stone-600">
          Tap &ldquo;Start Work&rdquo; when you are ready to begin, so Canary knows you are on the job.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={handleStartWork}
          disabled={isPending}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? 'Updating…' : 'Start Work'}
        </button>
      </div>
    )
  }

  if (status === 'in_progress') {
    return (
      <form onSubmit={handleMarkComplete} className="space-y-4">
        <p className="text-sm text-stone-600">
          Mark the job as complete when the work is done. You may optionally provide your invoice amount.
        </p>
        <div>
          <label htmlFor="invoice-amount" className="block text-sm font-medium text-stone-700 mb-1">
            Invoice Amount ($){' '}
            <span className="text-stone-400 font-normal">(optional — leave blank if no charge)</span>
          </label>
          <input
            id="invoice-amount"
            type="number"
            min="0"
            step="0.01"
            value={invoiceAmount}
            onChange={(e) => setInvoiceAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isPending ? 'Submitting…' : 'Mark Complete'}
        </button>
      </form>
    )
  }

  // All other statuses: informational only
  return null
}
