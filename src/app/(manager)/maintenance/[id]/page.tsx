// src/app/(manager)/maintenance/[id]/page.tsx
// Work order detail page — RSC. Shows full work order info and transition buttons.
// T-05-09: never selects owner_approve_token, owner_decline_token, or vendor_token.
// T-05-10: cost fields are in (manager) route group — layout enforces manager/admin role.

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { WorkOrderStatusBadge } from '@/components/work-orders/WorkOrderStatusBadge'
import { TransitionButton } from '@/components/work-orders/TransitionButton'
import { AssignVendorDialog } from '@/components/work-orders/AssignVendorDialog'
import type { WorkOrderStatus, WorkOrderPriority } from '@/lib/work-orders/transitions'
import type { VendorOption } from '@/components/work-orders/AssignVendorDialog'

// Priority label map
const PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

const PRIORITY_BADGE_CLASS: Record<WorkOrderPriority, string> = {
  low: 'inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600',
  medium:
    'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700',
  high: 'inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700',
  urgent:
    'inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatCurrency(val: number | null) {
  if (val == null) return '—'
  return '$' + val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function WorkOrderDetailPage({ params }: PageProps) {
  // Next.js 15: async params
  const { id } = await params

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: callerPerson } = await supabase
    .from('people')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!callerPerson) redirect('/login')
  if (!callerPerson.role?.includes('manager') && !callerPerson.role?.includes('admin')) {
    redirect('/dashboard')
  }

  // Fetch work order — explicit column list, NO token columns (T-05-09)
  const { data: workOrder } = await supabase
    .from('work_orders')
    .select(
      `id, title, description, status, priority, created_at, updated_at,
       estimated_cost, vendor_cost, billed_amount, owner_decline_note,
       properties!property_id(street_address, city),
       units!unit_id(unit_number),
       vendor:people!assigned_vendor_id(first_name, last_name, email, phone),
       creator:people!created_by(first_name, last_name)`
    )
    .eq('id', id)
    .eq('org_id', callerPerson.org_id)
    .single()

  if (!workOrder) notFound()

  // Fetch vendors for AssignVendorDialog — people in same org with role includes 'vendor'
  const { data: vendorRows } = await supabase
    .from('people')
    .select('id, first_name, last_name, email, phone, role')
    .eq('org_id', callerPerson.org_id)
    .eq('active', true)

  // Coerce nullable name fields — DB allows null but VendorOption requires string
  const vendors: VendorOption[] = (vendorRows ?? [])
    .filter((p) => Array.isArray(p.role) && p.role.includes('vendor'))
    .map((p) => ({
      id: p.id,
      first_name: p.first_name ?? '',
      last_name: p.last_name ?? '',
      email: p.email,
      phone: p.phone,
    }))

  const wo = workOrder as unknown as {
    id: string
    title: string
    description: string
    status: WorkOrderStatus
    priority: WorkOrderPriority
    created_at: string
    updated_at: string
    estimated_cost: number | null
    vendor_cost: number | null
    billed_amount: number | null
    owner_decline_note: string | null
    properties: { street_address: string; city: string } | null
    units: { unit_number: string } | null
    vendor: { first_name: string; last_name: string; email: string | null; phone: string | null } | null
    creator: { first_name: string; last_name: string } | null
  }

  const userRole = (callerPerson.role ?? []) as string[]

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      {/* Back link */}
      <div className="mb-4">
        <Link href="/maintenance" className="text-sm text-stone-500 hover:text-stone-700">
          ← Maintenance
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start gap-3 mb-2">
          <h1 className="text-xl font-semibold text-stone-900 flex-1">{wo.title}</h1>
          <WorkOrderStatusBadge status={wo.status} />
          <span className={PRIORITY_BADGE_CLASS[wo.priority]}>
            {PRIORITY_LABELS[wo.priority]}
          </span>
        </div>
        <p className="text-sm text-stone-500">
          Created{' '}
          {wo.creator
            ? `by ${wo.creator.first_name} ${wo.creator.last_name} `
            : ''}
          on {formatDate(wo.created_at)}
        </p>
      </div>

      <div className="space-y-6">
        {/* Property + Unit */}
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-stone-700 mb-3">Location</h2>
          <div className="text-sm text-stone-600">
            {wo.properties ? (
              <>
                <p>{wo.properties.street_address}, {wo.properties.city}</p>
                {wo.units && <p className="text-stone-400">Unit {wo.units.unit_number}</p>}
              </>
            ) : (
              <p className="text-stone-400">No property specified</p>
            )}
          </div>
        </section>

        {/* Description */}
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-stone-700 mb-3">Description</h2>
          <p className="text-sm text-stone-700 whitespace-pre-wrap">{wo.description}</p>
        </section>

        {/* Cost fields — manager-only (T-05-10, MAINT-08) */}
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-stone-700 mb-3">Cost Details</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-stone-400 mb-0.5">Estimated Cost</p>
              <p className="font-medium text-stone-800">{formatCurrency(wo.estimated_cost)}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400 mb-0.5">Vendor Cost</p>
              <p className="font-medium text-stone-800">{formatCurrency(wo.vendor_cost)}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400 mb-0.5">Billed to Owner</p>
              <p className="font-medium text-stone-800">{formatCurrency(wo.billed_amount)}</p>
            </div>
          </div>
        </section>

        {/* Vendor */}
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-stone-700 mb-3">Assigned Vendor</h2>
          {wo.vendor ? (
            <div className="text-sm text-stone-700 space-y-1">
              <p className="font-medium">
                {wo.vendor.first_name} {wo.vendor.last_name}
              </p>
              {wo.vendor.email && <p className="text-stone-500">{wo.vendor.email}</p>}
              {wo.vendor.phone && <p className="text-stone-500">{wo.vendor.phone}</p>}
            </div>
          ) : (
            <p className="text-sm text-stone-400 italic">Unassigned — use "Assign Vendor" to assign.</p>
          )}
        </section>

        {/* Owner decline note (if present) */}
        {wo.owner_decline_note && (
          <section className="rounded-xl border border-red-200 bg-red-50 p-5">
            <h2 className="text-sm font-semibold text-red-700 mb-2">Owner Decline Note</h2>
            <p className="text-sm text-red-800">{wo.owner_decline_note}</p>
          </section>
        )}

        {/* State transitions */}
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-stone-700 mb-3">Actions</h2>
          <TransitionButton
            workOrderId={wo.id}
            currentStatus={wo.status}
            userRole={userRole}
          />
          {/* AssignVendorDialog — assign vendor to submitted or approved work orders */}
          {(wo.status === 'submitted' || wo.status === 'approved') ? (
            <div className="mt-3">
              <AssignVendorDialog
                workOrderId={wo.id}
                vendors={vendors}
              />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
