// src/app/(vendor-nologin)/vendor/jobs/[token]/page.tsx
// No-login vendor job page. Validates vendor_token server-side using admin client.
// T-05-12: admin client used ONLY for token lookup (read). Writes go through
//          updateViaVendorToken which re-validates the token.
// T-05-13: billed_amount NOT selected — markup not exposed to vendor.
// No auth required — the vendor_token UUID is the credential.

import { createAdminClient } from '@/lib/supabase/admin'
import { VendorActions } from './VendorActions'

interface PageProps {
  params: Promise<{ token: string }>
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

const PRIORITY_BADGE_CLASS: Record<string, string> = {
  low: 'inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600',
  medium: 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700',
  high: 'inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700',
  urgent: 'inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  assigned: 'Assigned — awaiting start',
  in_progress: 'In Progress',
  pending_approval: 'Pending Owner Approval',
  approved: 'Approved',
  completed: 'Completed',
  closed: 'Closed',
}

function LinkExpiredPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
          Canary Property Management
        </p>
        <h1 className="text-xl font-semibold text-stone-900 mb-3">Link No Longer Active</h1>
        <p className="text-sm text-stone-500">
          This work order link is no longer active. The work order may have been closed or
          reassigned. If you have questions, please contact Canary Property Management directly.
        </p>
      </div>
    </main>
  )
}

export default async function VendorJobPage({ params }: PageProps) {
  const { token } = await params

  if (!token?.trim()) {
    return <LinkExpiredPage />
  }

  // T-05-12: use admin client — anon cannot read work_orders.
  // The vendor_token is the credential; validate server-side.
  const adminSupabase = createAdminClient()

  const { data: workOrder } = await adminSupabase
    .from('work_orders')
    .select(
      `id, title, description, priority, status, vendor_token, estimated_cost, vendor_cost, created_at,
       properties!property_id(street_address, city),
       units!unit_id(unit_number)`
    )
    .eq('vendor_token', token)
    .neq('status', 'closed')
    // T-05-13: deliberately NOT selecting billed_amount — markup not visible to vendor
    .single()

  if (!workOrder) {
    return <LinkExpiredPage />
  }

  type WO = {
    id: string
    title: string
    description: string
    priority: string
    status: string
    vendor_token: string
    estimated_cost: number | null
    vendor_cost: number | null
    created_at: string
    properties: { street_address: string; city: string } | null
    units: { unit_number: string } | null
  }

  const wo = workOrder as unknown as WO

  const propertyLine = wo.properties
    ? `${wo.properties.street_address}, ${wo.properties.city}`
    : 'Property not specified'
  const unitLine = wo.units ? `Unit ${wo.units.unit_number}` : null

  const statusLabel = STATUS_LABELS[wo.status] ?? wo.status
  const priorityLabel = PRIORITY_LABELS[wo.priority] ?? wo.priority
  const priorityBadgeClass = PRIORITY_BADGE_CLASS[wo.priority] ??
    'inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600'

  // Status message for terminal / non-actionable states
  function StatusMessage() {
    if (wo.status === 'completed' || wo.status === 'approved' || wo.status === 'pending_approval') {
      return (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <p className="text-sm font-medium text-green-800">
            Work order submitted — thank you. Canary Property Management has been notified.
          </p>
        </div>
      )
    }
    if (wo.status === 'draft' || wo.status === 'submitted') {
      return (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm font-medium text-amber-800">
            This work order has not been assigned yet. Please contact Canary Property Management.
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      {/* Header */}
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">
          Canary Property Management
        </p>
        <h1 className="text-xl font-semibold text-stone-900">Work Order</h1>
      </div>

      <div className="space-y-4">
        {/* Job info card */}
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start gap-2 mb-3">
            <h2 className="text-base font-semibold text-stone-900 flex-1">{wo.title}</h2>
            <span className={priorityBadgeClass}>{priorityLabel}</span>
          </div>

          {/* Location */}
          <div className="mb-3 text-sm text-stone-600">
            <p className="font-medium">{propertyLine}</p>
            {unitLine && <p className="text-stone-400">{unitLine}</p>}
          </div>

          {/* Description */}
          {wo.description && (
            <p className="text-sm text-stone-700 whitespace-pre-wrap">{wo.description}</p>
          )}
        </section>

        {/* Current status */}
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1.5">
            Current Status
          </p>
          <p className="text-base font-semibold text-stone-900">{statusLabel}</p>
        </section>

        {/* Action section */}
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">
            Actions
          </p>
          <StatusMessage />
          {/* VendorActions handles assigned and in_progress statuses */}
          {(wo.status === 'assigned' || wo.status === 'in_progress') && (
            <VendorActions token={token} status={wo.status} />
          )}
        </section>
      </div>

      {/* Footer */}
      <p className="mt-8 text-center text-xs text-stone-400">
        Canary PropOS &mdash; Powered by Canary Property Management
      </p>
    </main>
  )
}
