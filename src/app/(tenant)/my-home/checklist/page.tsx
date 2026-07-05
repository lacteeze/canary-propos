// src/app/(tenant)/my-home/checklist/page.tsx
// Tenant checklist view — RSC. D-11: no vendor_cost or billed_amount selected.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChecklistForm } from './ChecklistForm'

export default async function TenantChecklistPage() {
  const supabase = await createClient()

  // 1. Session guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Resolve person
  const { data: person } = await supabase
    .from('people')
    .select('id, role, first_name, last_name')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) redirect('/login')
  if (!person.role.includes('tenant')) redirect('/login')

  // 3. Fetch active lease
  const { data: lease } = await supabase
    .from('leases')
    .select('id')
    .eq('tenant_id', person.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!lease) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 md:px-8">
        <h1 className="mb-2 text-xl font-semibold text-stone-900">My Checklist</h1>
        <div className="rounded-xl border border-dashed border-stone-300 py-12 text-center">
          <p className="text-base font-medium text-stone-700">No active lease found.</p>
          <p className="mt-1 text-sm text-stone-500">Contact your property manager for assistance.</p>
        </div>
      </div>
    )
  }

  // 4. Fetch most recent checklist for this lease
  const { data: checklist } = await supabase
    .from('checklists')
    .select('id, title, type, submitted_at, created_at')
    .eq('lease_id', lease.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!checklist) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 md:px-8">
        <h1 className="mb-2 text-xl font-semibold text-stone-900">My Checklist</h1>
        <div className="rounded-xl border border-dashed border-stone-300 py-12 text-center">
          <p className="text-base font-medium text-stone-700">No checklist prepared yet.</p>
          <p className="mt-1 text-sm text-stone-500">
            Check back after move-in — your property manager will prepare one for you.
          </p>
        </div>
      </div>
    )
  }

  // 5. Fetch checklist items — D-11 safe (no cost fields)
  const { data: items } = await supabase
    .from('checklist_items')
    .select('id, position, label, checked, note, checked_at')
    .eq('checklist_id', checklist.id)
    .order('position', { ascending: true })

  const isSubmitted = !!checklist.submitted_at

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-stone-900">My Checklist</h1>
        <p className="mt-1 text-sm text-stone-500">
          Review each item and submit your sign-off when complete.
        </p>
      </div>

      <ChecklistForm
        checklistId={checklist.id}
        checklistTitle={checklist.title}
        checklistType={checklist.type as 'move_in' | 'move_out'}
        items={items ?? []}
        isSubmitted={isSubmitted}
        submittedAt={checklist.submitted_at}
      />
    </div>
  )
}
