'use client'

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
    return <div className="cy-portal-alert cy-portal-alert--ok">{message}</div>
  }

  if (status === 'assigned') {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <p className="cy-portal-muted" style={{ margin: 0 }}>
          Tap &ldquo;Start Work&rdquo; when you are ready to begin, so Canary knows you are on the job.
        </p>
        {error && <div className="cy-portal-alert cy-portal-alert--err">{error}</div>}
        <button
          type="button"
          onClick={handleStartWork}
          disabled={isPending}
          className="cy-btn-primary"
          style={{ width: '100%', padding: '10px 16px' }}
        >
          {isPending ? 'Updating…' : 'Start work'}
        </button>
      </div>
    )
  }

  if (status === 'in_progress') {
    return (
      <form onSubmit={handleMarkComplete} style={{ display: 'grid', gap: 14 }}>
        <p className="cy-portal-muted" style={{ margin: 0 }}>
          Mark the job as complete when the work is done. You may optionally provide your invoice
          amount.
        </p>
        <div className="cy-portal-field">
          <label htmlFor="invoice-amount" className="cy-portal-label">
            Invoice amount ($){' '}
            <span style={{ color: 'var(--faint)', fontWeight: 500 }}>
              (optional — leave blank if no charge)
            </span>
          </label>
          <input
            id="invoice-amount"
            type="number"
            min="0"
            step="0.01"
            value={invoiceAmount}
            onChange={(e) => setInvoiceAmount(e.target.value)}
            placeholder="0.00"
            className="cy-input"
          />
        </div>
        {error && <div className="cy-portal-alert cy-portal-alert--err">{error}</div>}
        <button
          type="submit"
          disabled={isPending}
          className="cy-btn-primary"
          style={{ width: '100%', padding: '10px 16px' }}
        >
          {isPending ? 'Submitting…' : 'Mark complete'}
        </button>
      </form>
    )
  }

  return null
}
