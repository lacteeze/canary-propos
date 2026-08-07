// Tenant work order list — RSC. RLS tenants_select_own policy scopes to created_by automatically.
// T-05-20: NEVER select vendor_cost, billed_amount, estimated_cost, vendor_token, owner_approve_token,
//          owner_decline_token, assigned_vendor_id.
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { CSSProperties } from 'react'

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending_approval: 'Pending Approval',
  completed: 'Completed',
  closed: 'Closed',
}

function priorityChipStyle(priority: string): CSSProperties {
  if (priority === 'urgent') {
    return { background: 'color-mix(in srgb, var(--red) 14%, var(--panel))', color: 'var(--red)' }
  }
  if (priority === 'high') {
    return { background: 'color-mix(in srgb, var(--amber) 14%, var(--panel))', color: 'var(--amber)' }
  }
  if (priority === 'medium') {
    return { background: 'color-mix(in srgb, var(--blue) 14%, var(--panel))', color: 'var(--blue)' }
  }
  return { background: 'var(--elev)', color: 'var(--dim)' }
}

function statusChipStyle(status: string): CSSProperties {
  if (status === 'completed') {
    return { background: 'color-mix(in srgb, var(--green) 14%, var(--panel))', color: 'var(--green)' }
  }
  if (status === 'in_progress') {
    return { background: 'color-mix(in srgb, var(--blue) 14%, var(--panel))', color: 'var(--blue)' }
  }
  if (status === 'assigned') {
    return { background: 'color-mix(in srgb, var(--blue) 14%, var(--panel))', color: 'var(--blue)' }
  }
  if (status === 'pending_approval') {
    return { background: 'color-mix(in srgb, var(--amber) 14%, var(--panel))', color: 'var(--amber)' }
  }
  return { background: 'var(--elev)', color: 'var(--dim)' }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default async function TenantMaintenancePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: person } = await supabase
    .from('people')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()
  if (!person) redirect('/login')
  if (!person.role.includes('tenant')) redirect('/login')

  const { data: workOrders } = await supabase
    .from('work_orders')
    .select(`
      id,
      title,
      description,
      priority,
      status,
      created_at,
      updated_at,
      properties(street_address, city)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="cy-portal-page">
      <div className="cy-portal-page-head">
        <div>
          <h1 className="cy-portal-title">My maintenance requests</h1>
          <p className="cy-portal-sub">Track the status of your submitted requests.</p>
        </div>
        <Link href="/my-home/maintenance/new" className="cy-btn-primary">
          Submit request
        </Link>
      </div>

      {!workOrders || workOrders.length === 0 ? (
        <div className="cy-portal-empty">
          <p className="cy-portal-empty-title">No maintenance requests yet.</p>
          <p className="cy-portal-empty-sub">
            Have a repair or issue?{' '}
            <Link href="/my-home/maintenance/new" className="cy-portal-link">
              Submit your first request
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="cy-portal-table-wrap hidden md:block">
            <table className="cy-portal-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Property</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((wo) => {
                  const prop = Array.isArray(wo.properties) ? wo.properties[0] : wo.properties
                  return (
                    <tr key={wo.id}>
                      <td className="strong">{wo.title}</td>
                      <td>{prop ? `${prop.street_address}, ${prop.city}` : '—'}</td>
                      <td>
                        <span className="cy-status-chip" style={priorityChipStyle(wo.priority)}>
                          {PRIORITY_LABELS[wo.priority] ?? wo.priority}
                        </span>
                      </td>
                      <td>
                        <span className="cy-status-chip" style={statusChipStyle(wo.status)}>
                          {STATUS_LABELS[wo.status] ?? wo.status}
                        </span>
                      </td>
                      <td>{formatDate(wo.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="cy-portal-stack md:hidden">
            {workOrders.map((wo) => {
              const prop = Array.isArray(wo.properties) ? wo.properties[0] : wo.properties
              return (
                <div key={wo.id} className="cy-portal-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--text)' }}>{wo.title}</p>
                    <span className="cy-status-chip" style={statusChipStyle(wo.status)}>
                      {STATUS_LABELS[wo.status] ?? wo.status}
                    </span>
                  </div>
                  {prop && (
                    <p className="cy-portal-muted" style={{ margin: '0 0 10px' }}>
                      {prop.street_address}, {prop.city}
                    </p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="cy-status-chip" style={priorityChipStyle(wo.priority)}>
                      {PRIORITY_LABELS[wo.priority] ?? wo.priority}
                    </span>
                    <span className="cy-portal-muted" style={{ fontSize: 12 }}>
                      {formatDate(wo.created_at)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
