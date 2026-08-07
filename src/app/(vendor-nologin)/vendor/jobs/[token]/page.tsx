// No-login vendor job page. Validates vendor_token server-side using admin client.
// T-05-12: admin client used ONLY for token lookup (read).
// T-05-13: billed_amount NOT selected — markup not exposed to vendor.

import { createAdminClient } from '@/lib/supabase/admin'
import { VendorActions } from './VendorActions'
import type { CSSProperties } from 'react'

interface PageProps {
  params: Promise<{ token: string }>
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

function priorityChipStyle(priority: string): CSSProperties {
  if (priority === 'urgent') {
    return { background: 'color-mix(in srgb, var(--red) 14%, var(--panel))', color: 'var(--red)' }
  }
  if (priority === 'high') {
    return { background: 'color-mix(in srgb, var(--amber) 14%, var(--panel))', color: 'var(--amber)' }
  }
  if (priority === 'medium') {
    return { background: 'color-mix(in srgb, var(--amber) 10%, var(--panel))', color: 'var(--amber)' }
  }
  return { background: 'var(--elev)', color: 'var(--dim)' }
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
    <div className="cnry cy-portal-standalone" data-ui="macos27" data-theme="light">
      <div className="cy-portal-card" style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <p className="cy-eyebrow" style={{ marginBottom: 10 }}>
          Canary Property Management
        </p>
        <h1 className="cy-portal-title" style={{ fontSize: 20 }}>
          Link no longer active
        </h1>
        <p className="cy-portal-sub">
          This work order link is no longer active. The work order may have been closed or
          reassigned. If you have questions, please contact Canary Property Management directly.
        </p>
      </div>
    </div>
  )
}

export default async function VendorJobPage({ params }: PageProps) {
  const { token } = await params

  if (!token?.trim()) {
    return <LinkExpiredPage />
  }

  const adminSupabase = createAdminClient()

  const { data: workOrder } = await adminSupabase
    .from('work_orders')
    .select(
      `id, title, description, priority, status, vendor_token, estimated_cost, vendor_cost, created_at,
       properties!property_id(street_address, city),
       units!unit_id(unit_number)`,
    )
    .eq('vendor_token', token)
    .neq('status', 'closed')
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

  function StatusMessage() {
    if (wo.status === 'completed' || wo.status === 'approved' || wo.status === 'pending_approval') {
      return (
        <div className="cy-portal-alert cy-portal-alert--ok">
          Work order submitted — thank you. Canary Property Management has been notified.
        </div>
      )
    }
    if (wo.status === 'draft' || wo.status === 'submitted') {
      return (
        <div className="cy-portal-alert cy-portal-alert--warn">
          This work order has not been assigned yet. Please contact Canary Property Management.
        </div>
      )
    }
    return null
  }

  return (
    <div className="cnry cy-portal-standalone" data-ui="macos27" data-theme="light">
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <p className="cy-eyebrow" style={{ marginBottom: 6 }}>
            Canary Property Management
          </p>
          <h1 className="cy-portal-title">Work order</h1>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <section className="cy-portal-card">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <h2 style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                {wo.title}
              </h2>
              <span className="cy-status-chip" style={priorityChipStyle(wo.priority)}>
                {priorityLabel}
              </span>
            </div>
            <div className="cy-portal-muted" style={{ marginBottom: 10 }}>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text)' }}>{propertyLine}</p>
              {unitLine && <p style={{ margin: '2px 0 0' }}>{unitLine}</p>}
            </div>
            {wo.description && (
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                {wo.description}
              </p>
            )}
          </section>

          <section className="cy-portal-card">
            <p className="cy-eyebrow" style={{ marginBottom: 6 }}>
              Current status
            </p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              {statusLabel}
            </p>
          </section>

          <section className="cy-portal-card">
            <p className="cy-eyebrow" style={{ marginBottom: 10 }}>
              Actions
            </p>
            <StatusMessage />
            {(wo.status === 'assigned' || wo.status === 'in_progress') && (
              <div style={{ marginTop: 10 }}>
                <VendorActions token={token} status={wo.status} />
              </div>
            )}
          </section>
        </div>

        <p className="cy-portal-muted" style={{ marginTop: 24, textAlign: 'center', fontSize: 12 }}>
          Canary PropOS — Powered by Canary Property Management
        </p>
      </div>
    </div>
  )
}
