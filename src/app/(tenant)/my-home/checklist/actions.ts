'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string }

// Helper: resolve caller context
async function getCallerContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: person } = await supabase
    .from('people')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) return null
  return { supabase, user, person }
}

// createChecklist — manager/employee only
export async function createChecklist(
  leaseId: string,
  type: 'move_in' | 'move_out',
  title: string,
  items: string[]
): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  const { supabase, person } = ctx

  if (!person.role.includes('manager') && !person.role.includes('employee')) {
    return { success: false, error: 'Only managers can create checklists.' }
  }

  if (!title.trim()) return { success: false, error: 'Title is required.' }
  if (!items.length || items.every(i => !i.trim())) {
    return { success: false, error: 'At least one item is required.' }
  }

  const validItems = items.map(i => i.trim()).filter(Boolean)
  if (!validItems.length) return { success: false, error: 'At least one item is required.' }

  // Insert checklist
  const { data: checklist, error: checklistError } = await supabase
    .from('checklists')
    .insert({
      lease_id: leaseId,
      org_id: person.org_id,
      type,
      title: title.trim(),
      created_by: person.id,
    })
    .select('id')
    .single()

  if (checklistError || !checklist) {
    return { success: false, error: checklistError?.message ?? 'Failed to create checklist.' }
  }

  // Insert items
  const itemRows = validItems.map((label, position) => ({
    checklist_id: checklist.id,
    label,
    position,
  }))

  const { error: itemsError } = await supabase
    .from('checklist_items')
    .insert(itemRows)

  if (itemsError) {
    return { success: false, error: itemsError.message }
  }

  revalidatePath(`/leases/${leaseId}`)
  return { success: true, id: checklist.id }
}

// updateChecklistItem — tenant only
export async function updateChecklistItem(
  itemId: string,
  checked: boolean,
  note: string | null
): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  const { supabase, person } = ctx

  if (!person.role.includes('tenant')) {
    return { success: false, error: 'Only tenants can update checklist items.' }
  }

  const { error } = await supabase
    .from('checklist_items')
    .update({
      checked,
      note: note ?? null,
      checked_at: checked ? new Date().toISOString() : null,
    })
    .eq('id', itemId)

  if (error) {
    // RLS blocks updates on submitted checklists
    if (error.code === '42501' || error.message?.toLowerCase().includes('policy')) {
      return { success: false, error: 'Checklist already submitted.' }
    }
    return { success: false, error: error.message }
  }

  revalidatePath('/my-home/checklist')
  return { success: true }
}

// submitChecklist — tenant only; idempotent via WHERE submitted_at IS NULL
export async function submitChecklist(checklistId: string): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  const { supabase, person } = ctx

  if (!person.role.includes('tenant')) {
    return { success: false, error: 'Only tenants can submit checklists.' }
  }

  // 1. Set submitted_at on the checklist (only if not already submitted)
  const { data: updated, error: submitError } = await supabase
    .from('checklists')
    .update({
      submitted_at: new Date().toISOString(),
      submitted_by: person.id,
    })
    .eq('id', checklistId)
    .is('submitted_at', null)
    .select('id')

  if (submitError) {
    return { success: false, error: submitError.message }
  }

  if (!updated || updated.length === 0) {
    return { success: false, error: 'Checklist has already been submitted.' }
  }

  // 2. Set checked_at on all checked items that don't have it yet
  await supabase
    .from('checklist_items')
    .update({ checked_at: new Date().toISOString() })
    .eq('checklist_id', checklistId)
    .eq('checked', true)
    .is('checked_at', null)

  revalidatePath('/my-home/checklist')
  return { success: true }
}
