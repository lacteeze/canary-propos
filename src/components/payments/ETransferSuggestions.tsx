'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { recordPayment } from '@/app/(manager)/payments/actions'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface LeaseOption {
  id: string
  tenant_name: string
  property_address: string
}

interface ETransferSuggestion {
  id: string
  sender_name: string
  amount: number
  received_at: string
  subject: string
}

interface ETransferSuggestionsProps {
  leases: LeaseOption[]
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function ETransferSuggestions({ leases }: ETransferSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<ETransferSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [gmailError, setGmailError] = useState(false)
  // Per-suggestion selected lease id
  const [selectedLeases, setSelectedLeases] = useState<Record<string, string>>({})
  // Per-suggestion confirming state
  const [confirming, setConfirming] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const res = await fetch('/api/gmail/etransfers')
        if (!res.ok) {
          setGmailError(true)
          return
        }
        const data = await res.json()
        setSuggestions(data ?? [])
      } catch {
        setGmailError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchSuggestions()
  }, [])

  async function handleConfirm(suggestion: ETransferSuggestion) {
    const leaseId = selectedLeases[suggestion.id]
    if (!leaseId) {
      toast.error('Please select a lease before confirming.')
      return
    }

    setConfirming((prev) => ({ ...prev, [suggestion.id]: true }))
    try {
      const today = new Date().toISOString().split('T')[0]
      const result = await recordPayment({
        lease_id: leaseId,
        amount: suggestion.amount,
        method: 'etransfer',
        payment_date: today,
        notes: suggestion.subject,
      })

      if (result.success) {
        toast.success(`e-Transfer from ${suggestion.sender_name} confirmed.`)
        // Remove from local state after successful confirmation
        setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id))
      } else {
        toast.error(result.error)
      }
    } finally {
      setConfirming((prev) => ({ ...prev, [suggestion.id]: false }))
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-stone-800">e-Transfer Suggestions</h2>
        <p className="text-sm text-stone-500">Checking Gmail for e-transfer notifications…</p>
      </div>
    )
  }

  if (gmailError) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-stone-800">e-Transfer Suggestions</h2>
        <p className="text-sm text-stone-500">
          Connect Gmail in Settings to see e-transfer suggestions.
        </p>
      </div>
    )
  }

  if (suggestions.length === 0) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-stone-800">e-Transfer Suggestions</h2>
        <p className="text-sm text-stone-500">No new e-transfer notifications found.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      <div className="border-b border-stone-200 px-6 py-4">
        <h2 className="text-base font-semibold text-stone-800">
          e-Transfer Suggestions{' '}
          <span className="ml-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            {suggestions.length}
          </span>
        </h2>
        <p className="mt-0.5 text-xs text-stone-500">
          Select a lease and click Confirm to record each e-transfer.
        </p>
      </div>
      <ul className="divide-y divide-stone-100">
        {suggestions.map((suggestion) => (
          <li key={suggestion.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-stone-800">{suggestion.sender_name}</p>
              <p className="text-sm text-stone-600">{formatCurrency(suggestion.amount)}</p>
              <p className="text-xs text-stone-400">{formatDate(suggestion.received_at)}</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <Select
                value={selectedLeases[suggestion.id] ?? ''}
                onValueChange={(val) =>
                  setSelectedLeases((prev) => ({ ...prev, [suggestion.id]: val ?? '' }))
                }
              >
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Match to lease…" />
                </SelectTrigger>
                <SelectContent>
                  {leases.map((lease) => (
                    <SelectItem key={lease.id} value={lease.id}>
                      {lease.tenant_name} — {lease.property_address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => handleConfirm(suggestion)}
                disabled={!selectedLeases[suggestion.id] || confirming[suggestion.id]}
              >
                {confirming[suggestion.id] ? 'Confirming…' : 'Confirm Payment'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
