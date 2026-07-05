'use client'
// src/components/work-orders/WorkOrderList.tsx
// Desktop table + mobile cards for work order list view.

import Link from 'next/link'
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge'
import type { WorkOrderStatus, WorkOrderPriority } from '@/lib/work-orders/transitions'

const PRIORITY_CONFIG: Record<
  WorkOrderPriority,
  { label: string; className: string }
> = {
  low: {
    label: 'Low',
    className:
      'inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600',
  },
  medium: {
    label: 'Medium',
    className:
      'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700',
  },
  high: {
    label: 'High',
    className:
      'inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700',
  },
  urgent: {
    label: 'Urgent',
    className:
      'inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700',
  },
}

function PriorityBadge({ priority }: { priority: WorkOrderPriority }) {
  const config = PRIORITY_CONFIG[priority] ?? {
    label: priority,
    className:
      'inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600',
  }
  return <span className={config.className}>{config.label}</span>
}

export interface WorkOrderRow {
  id: string
  title: string
  status: WorkOrderStatus
  priority: WorkOrderPriority
  created_at: string
  properties: {
    street_address: string
    city: string
  } | null
  units: {
    unit_number: string
  } | null
  vendor: {
    first_name: string
    last_name: string
  } | null
}

interface WorkOrderListProps {
  workOrders: WorkOrderRow[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function WorkOrderList({ workOrders }: WorkOrderListProps) {
  if (workOrders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-200 px-8 py-16 text-center">
        <p className="text-base font-medium text-stone-700">No work orders yet</p>
        <p className="mt-2 text-sm text-stone-500">
          Create a new work order to get started.{' '}
          <Link href="/maintenance/new" className="text-stone-700 underline hover:text-stone-900">
            Create one now
          </Link>
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-stone-200 md:block">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assigned To</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {workOrders.map((wo) => (
              <tr key={wo.id} className="bg-white hover:bg-stone-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/maintenance/${wo.id}`}
                    className="font-medium text-stone-900 hover:text-stone-700 hover:underline"
                  >
                    {wo.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-stone-600">
                  {wo.properties ? (
                    <div>
                      <div>{wo.properties.street_address}</div>
                      {wo.units && (
                        <div className="text-xs text-stone-400">Unit {wo.units.unit_number}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-stone-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={wo.priority} />
                </td>
                <td className="px-4 py-3">
                  <WorkOrderStatusBadge status={wo.status} />
                </td>
                <td className="px-4 py-3 text-stone-600">
                  {wo.vendor ? (
                    `${wo.vendor.first_name} ${wo.vendor.last_name}`
                  ) : (
                    <span className="text-stone-400">Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                  {formatDate(wo.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {workOrders.map((wo) => (
          <Link
            key={wo.id}
            href={`/maintenance/${wo.id}`}
            className="block rounded-xl border border-stone-200 bg-white p-4 hover:bg-stone-50"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="font-medium text-stone-900">{wo.title}</p>
              <WorkOrderStatusBadge status={wo.status} />
            </div>
            <div className="space-y-1 text-sm text-stone-600">
              {wo.properties && (
                <p>
                  {wo.properties.street_address}
                  {wo.units && `, Unit ${wo.units.unit_number}`}
                </p>
              )}
              <div className="flex items-center gap-2">
                <PriorityBadge priority={wo.priority} />
                <span className="text-xs text-stone-400">{formatDate(wo.created_at)}</span>
              </div>
              {wo.vendor && (
                <p className="text-xs text-stone-500">
                  Assigned: {wo.vendor.first_name} {wo.vendor.last_name}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
