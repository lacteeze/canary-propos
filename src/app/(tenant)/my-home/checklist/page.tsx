// Tenant checklist view — RSC. D-11: no vendor_cost or billed_amount selected.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChecklistForm } from './ChecklistForm'

export default async function TenantChecklistPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: person } = await supabase
    .from('people')
    .select('id, role, first_name, last_name')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) redirect('/login')
  if (!person.role.includes('tenant')) redirect('/login')

  const { data: lease } = await supabase
    .from('leases')
    .select('id')
    .eq('tenant_id', person.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!lease) {
    return (
      <div className="cy-portal-page" style={{ maxWidth: 640 }}>
        <h1 className="cy-portal-title">My checklist</h1>
        <div className="cy-portal-empty">
          <p className="cy-portal-empty-title">No active lease found.</p>
          <p className="cy-portal-empty-sub">Contact your property manager for assistance.</p>
        </div>
      </div>
    )
  }

  const { data: checklist } = await supabase
    .from('checklists')
    .select('id, title, type, submitted_at, created_at')
    .eq('lease_id', lease.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!checklist) {
    return (
      <div className="cy-portal-page" style={{ maxWidth: 640 }}>
        <h1 className="cy-portal-title">My checklist</h1>
        <div className="cy-portal-empty">
          <p className="cy-portal-empty-title">No checklist prepared yet.</p>
          <p className="cy-portal-empty-sub">
            Check back after move-in — your property manager will prepare one for you.
          </p>
        </div>
      </div>
    )
  }

  const { data: items } = await supabase
    .from('checklist_items')
    .select('id, position, label, checked, note, checked_at')
    .eq('checklist_id', checklist.id)
    .order('position', { ascending: true })

  const isSubmitted = !!checklist.submitted_at

  return (
    <div className="cy-portal-page" style={{ maxWidth: 640 }}>
      <div>
        <h1 className="cy-portal-title">My checklist</h1>
        <p className="cy-portal-sub">Review each item and submit your sign-off when complete.</p>
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
