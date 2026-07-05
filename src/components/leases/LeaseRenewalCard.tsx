'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { updateLeaseRenewal } from '@/app/actions/leases'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface LeaseRenewalCardProps {
  leaseId: string
  currentRenewalStatus: string | null
  currentProposedRent: number | null
}

const RENEWAL_STATUSES = ['pending', 'sent', 'accepted', 'declined'] as const
type RenewalStatus = (typeof RENEWAL_STATUSES)[number]

const statusLabel: Record<RenewalStatus, string> = {
  pending: 'Renewal Pending',
  sent: 'Renewal Sent',
  accepted: 'Renewal Accepted',
  declined: 'Renewal Declined',
}

export function LeaseRenewalCard({
  leaseId,
  currentRenewalStatus,
  currentProposedRent,
}: LeaseRenewalCardProps) {
  const [renewalStatus, setRenewalStatus] = useState<RenewalStatus | null>(
    (currentRenewalStatus as RenewalStatus) ?? null
  )
  const [proposedRent, setProposedRent] = useState<string>(
    currentProposedRent != null ? String(currentProposedRent) : ''
  )
  const [saving, setSaving] = useState(false)

  async function handleMarkPending() {
    setSaving(true)
    const result = await updateLeaseRenewal(leaseId, { renewal_status: 'pending' })
    if (!result.success) {
      toast.error(result.error)
    } else {
      toast.success('Renewal status set to Pending.')
      setRenewalStatus('pending')
    }
    setSaving(false)
  }

  async function handleStatusChange(value: string | null) {
    if (!value) return
    setSaving(true)
    const status = value as RenewalStatus
    const result = await updateLeaseRenewal(leaseId, {
      renewal_status: status,
      proposed_rent: proposedRent ? parseFloat(proposedRent) : undefined,
    })
    if (!result.success) {
      toast.error(result.error)
    } else {
      toast.success(`Renewal status updated to ${statusLabel[status]}.`)
      setRenewalStatus(status)
    }
    setSaving(false)
  }

  async function handleSaveProposedRent() {
    if (!renewalStatus) return
    setSaving(true)
    const result = await updateLeaseRenewal(leaseId, {
      renewal_status: renewalStatus,
      proposed_rent: proposedRent ? parseFloat(proposedRent) : undefined,
    })
    if (!result.success) {
      toast.error(result.error)
    } else {
      toast.success('Proposed rent saved.')
    }
    setSaving(false)
  }

  if (!renewalStatus) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleMarkPending}
        disabled={saving}
      >
        {saving ? 'Saving…' : 'Mark as Renewal Pending'}
      </Button>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-1 block text-sm font-medium text-stone-700">Renewal Status</Label>
        <Select value={renewalStatus} onValueChange={handleStatusChange} disabled={saving}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RENEWAL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(renewalStatus === 'pending' || renewalStatus === 'sent') && (
        <div>
          <Label className="mb-1 block text-sm font-medium text-stone-700">
            Proposed Rent ($)
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              step={0.01}
              value={proposedRent}
              onChange={(e) => setProposedRent(e.target.value)}
              className="w-36"
              placeholder="e.g. 1850.00"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveProposedRent}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
