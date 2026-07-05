'use client'
// src/components/work-orders/WorkOrderStatusBadge.tsx
// Color-coded status badge for all 8 work order states.

import type { WorkOrderStatus } from '@/lib/work-orders/transitions'

const STATUS_CONFIG: Record<
  WorkOrderStatus,
  { label: string; className: string }
> = {
  draft: {
    label: 'Draft',
    className:
      'inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600',
  },
  submitted: {
    label: 'Submitted',
    className:
      'inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700',
  },
  assigned: {
    label: 'Assigned',
    className:
      'inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700',
  },
  in_progress: {
    label: 'In Progress',
    className:
      'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700',
  },
  pending_approval: {
    label: 'Pending Approval',
    className:
      'inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700',
  },
  approved: {
    label: 'Approved',
    className:
      'inline-flex items-center rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-700',
  },
  completed: {
    label: 'Completed',
    className:
      'inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700',
  },
  closed: {
    label: 'Closed',
    className:
      'inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500',
  },
}

interface WorkOrderStatusBadgeProps {
  status: WorkOrderStatus
}

export function WorkOrderStatusBadge({ status }: WorkOrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className:
      'inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600',
  }
  return <span className={config.className}>{config.label}</span>
}
