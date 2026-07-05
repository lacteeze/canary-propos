'use client'

// src/components/work-orders/AssignVendorDialog.tsx
// Manager-only dialog for assigning a vendor to a work order.
// Collects: vendor (from people with role includes 'vendor'), estimated_cost, optional note.
// On submit: calls updateWorkOrderStatus(workOrderId, 'assigned', { assigned_vendor_id, estimated_cost })
// The server action transparently routes to pending_approval if estimated_cost > $500.

import { useState, useTransition } from 'react'
import { updateWorkOrderStatus } from '@/app/actions/work-orders'

export interface VendorOption {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
}

interface AssignVendorDialogProps {
  workOrderId: string
  vendors: VendorOption[]
  // Callback after successful assignment (e.g. to trigger router.refresh())
  onSuccess?: (wasRouted: boolean) => void
}

export function AssignVendorDialog({ workOrderId, vendors, onSuccess }: AssignVendorDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedVendorId, setSelectedVendorId] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [note, setNote] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [toastMsg, setToastMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  function handleOpen() {
    setOpen(true)
    setErrorMsg('')
    setToastMsg('')
  }

  function handleClose() {
    setOpen(false)
    setSelectedVendorId('')
    setEstimatedCost('')
    setNote('')
    setErrorMsg('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')

    if (!selectedVendorId) {
      setErrorMsg('Please select a vendor.')
      return
    }
    const costNum = parseFloat(estimatedCost)
    if (isNaN(costNum) || costNum < 0) {
      setErrorMsg('Please enter a valid estimated cost (0 or greater).')
      return
    }

    startTransition(async () => {
      const result = await updateWorkOrderStatus(workOrderId, 'assigned', {
        vendorId: selectedVendorId,
        estimatedCost: costNum,
      })

      if (!result.success) {
        setErrorMsg(result.error)
        return
      }

      // If cost > $500 the server silently routes to pending_approval (transparent to dialog).
      // We detect this client-side to show the correct toast message.
      const wasRouted = costNum > 500
      const msg = wasRouted
        ? 'Work order sent to owner for approval (cost > $500).'
        : 'Vendor assigned and notified.'

      handleClose()
      showToast(msg)
      onSuccess?.(wasRouted)
    })
  }

  return (
    <>
      {/* Toast notification */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-stone-900 px-5 py-3 text-sm text-white shadow-lg"
        >
          {toastMsg}
        </div>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
      >
        Assign Vendor
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-vendor-dialog-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
        >
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
              <h2 id="assign-vendor-dialog-title" className="text-base font-semibold text-stone-900">
                Assign Vendor
              </h2>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close dialog"
                className="text-stone-400 hover:text-stone-600"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              {/* Vendor select */}
              <div>
                <label
                  htmlFor="vendor-select"
                  className="block text-sm font-medium text-stone-700 mb-1"
                >
                  Vendor <span className="text-red-500">*</span>
                </label>
                {vendors.length === 0 ? (
                  <p className="text-sm text-stone-400 italic">
                    No vendors found. Add a contact with the &ldquo;vendor&rdquo; role first.
                  </p>
                ) : (
                  <select
                    id="vendor-select"
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select a vendor…</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.first_name} {v.last_name}
                        {v.email ? ` — ${v.email}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Estimated cost */}
              <div>
                <label
                  htmlFor="estimated-cost"
                  className="block text-sm font-medium text-stone-700 mb-1"
                >
                  Estimated Cost ($) <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-stone-400 mb-1.5">
                  If over $500, the work order will be sent to the owner for approval before work begins.
                </p>
                <input
                  id="estimated-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Optional note */}
              <div>
                <label
                  htmlFor="vendor-note"
                  className="block text-sm font-medium text-stone-700 mb-1"
                >
                  Note for Vendor <span className="text-stone-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="vendor-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Any additional instructions…"
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Error message */}
              {errorMsg && (
                <p role="alert" className="text-sm text-red-600">
                  {errorMsg}
                </p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isPending}
                  className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || vendors.length === 0}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPending ? 'Assigning…' : 'Assign Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
