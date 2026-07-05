// src/app/(tenant)/my-home/maintenance/page.tsx
// Tenant work order list — RSC. RLS tenants_select_own policy scopes to created_by automatically.
// T-05-20: NEVER select vendor_cost, billed_amount, estimated_cost, vendor_token, owner_approve_token,
//          owner_decline_token, assigned_vendor_id.
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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

function priorityBadgeClass(priority: string): string {
  if (priority === 'urgent') return 'inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700'
  if (priority === 'high') return 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700'
  if (priority === 'medium') return 'inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700'
  return 'inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600'
}

function statusBadgeClass(status: string): string {
  if (status === 'completed') return 'inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700'
  if (status === 'in_progress') return 'inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700'
  if (status === 'closed') return 'inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-500'
  if (status === 'assigned') return 'inline-flex items-center rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-700'
  if (status === 'pending_approval') return 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700'
  return 'inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600'
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default async function TenantMaintenancePage() {
  const supabase = await createClient()

  // 1. Session guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Resolve person row
  const { data: person } = await supabase
    .from('people')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()
  if (!person) redirect('/login')
  if (!person.role.includes('tenant')) redirect('/login')

  // 3. Fetch work orders — RLS tenants_select_own scopes to created_by = person.id automatically.
  //    T-05-20: only safe columns selected — no cost fields, no tokens, no vendor FK.
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
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">My Maintenance Requests</h1>
          <p className="mt-1 text-sm text-stone-500">Track the status of your submitted requests.</p>
        </div>
        <Link
          href="/my-home/maintenance/new"
          className="inline-flex items-center justify-center rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700"
        >
          Submit Request
        </Link>
      </div>

      {!workOrders || workOrders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 py-12 text-center">
          <p className="text-base font-medium text-stone-700">No maintenance requests yet.</p>
          <p className="mt-1 text-sm text-stone-500">
            Have a repair or issue?{' '}
            <Link
              href="/my-home/maintenance/new"
              className="underline underline-offset-2 hover:text-stone-800"
            >
              Submit your first request
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table (md+) */}
          <div className="hidden overflow-hidden rounded-xl border border-stone-200 md:block">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {workOrders.map((wo) => {
                  const prop = Array.isArray(wo.properties) ? wo.properties[0] : wo.properties
                  return (
                    <tr key={wo.id} className="bg-white hover:bg-stone-50">
                      <td className="px-4 py-3 font-medium text-stone-900">{wo.title}</td>
                      <td className="px-4 py-3 text-stone-600">
                        {prop ? `${prop.street_address}, ${prop.city}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={priorityBadgeClass(wo.priority)}>
                          {PRIORITY_LABELS[wo.priority] ?? wo.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusBadgeClass(wo.status)}>
                          {STATUS_LABELS[wo.status] ?? wo.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-stone-500">{formatDate(wo.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {workOrders.map((wo) => {
              const prop = Array.isArray(wo.properties) ? wo.properties[0] : wo.properties
              return (
                <div key={wo.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="font-medium text-stone-900">{wo.title}</p>
                    <span className={statusBadgeClass(wo.status)}>
                      {STATUS_LABELS[wo.status] ?? wo.status}
                    </span>
                  </div>
                  {prop && (
                    <p className="mb-2 text-sm text-stone-500">{prop.street_address}, {prop.city}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className={priorityBadgeClass(wo.priority)}>
                      {PRIORITY_LABELS[wo.priority] ?? wo.priority}
                    </span>
                    <p className="text-xs text-stone-400">{formatDate(wo.created_at)}</p>
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
