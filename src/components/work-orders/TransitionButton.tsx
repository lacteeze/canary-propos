'use client'
// src/components/work-orders/TransitionButton.tsx
// Renders available state transition buttons for a work order based on current status + caller role.
// Assignment transition (→ assigned) is excluded here — it lives in AssignVendorDialog (05-04).
// T-05-11: updateWorkOrderStatus re-validates server-side; button state is UI-only.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateWorkOrderStatus } from '@/app/actions/work-orders'
import { TRANSITIONS } from '@/lib/work-orders/transitions'
import type { WorkOrderStatus, AllowedRole } from '@/lib/work-orders/transitions'

interface TransitionButtonProps {
  workOrderId: string
  currentStatus: WorkOrderStatus
  userRole: string[]
}

// Transitions shown in the manager UI — assignment is handled by AssignVendorDialog (05-04)
const EXCLUDED_TRANSITIONS: WorkOrderStatus[] = ['assigned']

export function TransitionButton({ workOrderId, currentStatus, userRole }: TransitionButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<WorkOrderStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Completion form state
  const [showCompletionForm, setShowCompletionForm] = useState(false)
  const [vendorCost, setVendorCost] = useState('')
  const [billedAmount, setBilledAmount] = useState('')

  // Determine which transitions are available
  const availableTransitions = (Object.keys(TRANSITIONS) as WorkOrderStatus[]).filter(
    (toStatus) => {
      if (EXCLUDED_TRANSITIONS.includes(toStatus)) return false
      const config = TRANSITIONS[toStatus]
      if (!config.allowedFrom.includes(currentStatus)) return false
      return userRole.some((r) => config.allowedRoles.includes(r as AllowedRole))
    }
  )

  if (availableTransitions.length === 0) {
    return (
      <p className="text-sm text-stone-400 italic">No transitions available for this status.</p>
    )
  }

  async function handleTransition(newStatus: WorkOrderStatus) {
    setError(null)
    setLoading(newStatus)
    try {
      const result = await updateWorkOrderStatus(workOrderId, newStatus)
      if (!result.success) {
        setError(result.error)
      } else {
        router.refresh()
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(null)
    }
  }

  async function handleComplete(e: React.FormEvent) {
    e.preventDefault()
    const vc = parseFloat(vendorCost)
    const ba = parseFloat(billedAmount)
    if (isNaN(vc) || vc < 0) {
      setError('Vendor cost must be a valid positive number.')
      return
    }
    if (isNaN(ba) || ba < 0) {
      setError('Billed amount must be a valid positive number.')
      return
    }
    setError(null)
    setLoading('completed')
    try {
      const result = await updateWorkOrderStatus(workOrderId, 'completed', {
        vendorCost: vc,
        billedAmount: ba,
      })
      if (!result.success) {
        setError(result.error)
      } else {
        setShowCompletionForm(false)
        router.refresh()
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {availableTransitions.map((toStatus) => {
          if (toStatus === 'completed') {
            return (
              <button
                key={toStatus}
                type="button"
                onClick={() => setShowCompletionForm(true)}
                className="rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-100 disabled:opacity-50"
                disabled={loading !== null}
              >
                Mark Completed
              </button>
            )
          }

          const label = toStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          const isLoading = loading === toStatus

          return (
            <button
              key={toStatus}
              type="button"
              onClick={() => handleTransition(toStatus)}
              disabled={loading !== null}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              {isLoading ? 'Updating…' : label}
            </button>
          )
        })}
      </div>

      {/* Inline completion form — collects vendor_cost + billed_amount (D-13/MAINT-08) */}
      {showCompletionForm && (
        <form
          onSubmit={handleComplete}
          className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3"
        >
          <p className="text-sm font-medium text-stone-800">Complete Work Order</p>
          <p className="text-xs text-stone-500">
            Enter the final costs before marking this work order as completed. These will be
            recorded as an expense.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="vendor-cost"
                className="block text-xs font-medium text-stone-700 mb-1"
              >
                Vendor Cost ($)
              </label>
              <input
                id="vendor-cost"
                type="number"
                min="0"
                step="0.01"
                required
                value={vendorCost}
                onChange={(e) => setVendorCost(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-stone-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="billed-amount"
                className="block text-xs font-medium text-stone-700 mb-1"
              >
                Billed to Owner ($)
              </label>
              <input
                id="billed-amount"
                type="number"
                min="0"
                step="0.01"
                required
                value={billedAmount}
                onChange={(e) => setBilledAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-stone-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading === 'completed'}
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {loading === 'completed' ? 'Saving…' : 'Confirm Completion'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCompletionForm(false)
                setError(null)
              }}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
