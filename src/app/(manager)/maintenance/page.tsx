// src/app/(manager)/maintenance/page.tsx
// Manager work order list page — RSC, desktop table + mobile cards.
// T-05-09: never selects owner_approve_token, owner_decline_token, or vendor_token.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { WorkOrderList } from '@/components/work-orders/WorkOrderList'
import type { WorkOrderRow } from '@/components/work-orders/WorkOrderList'

export default async function MaintenancePage() {
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

  // Fetch work orders — explicit column list, NO token columns (T-05-09)
  const { data: rawWorkOrders } = await supabase
    .from('work_orders')
    .select(
      `id, title, status, priority, created_at,
       properties!property_id(street_address, city),
       units!unit_id(unit_number),
       vendor:people!assigned_vendor_id(first_name, last_name)`
    )
    .eq('org_id', callerPerson.org_id)
    .order('created_at', { ascending: false })

  const workOrders = (rawWorkOrders ?? []) as unknown as WorkOrderRow[]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      {/* Back link */}
      <div className="mb-4">
        <Link href="/dashboard" className="text-sm text-stone-500 hover:text-stone-700">
          ← Dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Maintenance</h1>
          <p className="mt-1 text-sm text-stone-500">
            {workOrders.length === 0
              ? 'No work orders yet.'
              : `${workOrders.length} work ${workOrders.length === 1 ? 'order' : 'orders'}`}
          </p>
        </div>
        <Link
          href="/maintenance/new"
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
        >
          New Work Order
        </Link>
      </div>

      <WorkOrderList workOrders={workOrders} />
    </div>
  )
}
