'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateTransition } from '@/lib/work-orders/transitions'
import { notifyOwnerPendingApproval } from '@/lib/work-orders/notifications'

// --- Action result type ---
export type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string }

// --- Helper: resolve the caller's org + role ---
async function getCallerContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

// --- Schema ---
const createWorkOrderSchema = z.object({
  property_id: z.string().uuid('Invalid property ID'),
  unit_id: z.string().uuid('Invalid unit ID').optional(),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
})

// --- createWorkOrder ---
// Called by both managers (from /maintenance/new) and tenants (from /my-home/maintenance/new).
// Tenants must have role includes 'tenant'. org_id is always resolved from session — never from input.
export async function createWorkOrder(data: {
  property_id: string
  unit_id?: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
}): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  const isManager = ctx.person.role.includes('manager') || ctx.person.role.includes('admin')
  const isTenant = ctx.person.role.includes('tenant')
  if (!isManager && !isTenant) {
    return { success: false, error: 'You do not have permission to create work orders.' }
  }

  const parsed = createWorkOrderSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  // T-05-21: org_id resolved from session, not form input
  const { error: insertError, data: inserted } = await ctx.supabase
    .from('work_orders')
    .insert({
      org_id: ctx.person.org_id,
      property_id: parsed.data.property_id,
      unit_id: parsed.data.unit_id ?? null,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      status: 'draft',
      created_by: ctx.person.id,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[createWorkOrder] insert error:', insertError)
    return { success: false, error: 'Failed to create work order. Please try again.' }
  }

  revalidatePath('/maintenance')
  revalidatePath('/my-home/maintenance')
  return { success: true, id: inserted.id }
}

// --- updateWorkOrderStatus ---
// Validates transition via TRANSITIONS map. Handles $500 gate (substitutes pending_approval).
// Auto-creates expense record when transitioning to 'completed'.
export async function updateWorkOrderStatus(
  workOrderId: string,
  newStatus: string,
  opts?: { vendorId?: string; estimatedCost?: number; vendorCost?: number; billedAmount?: number }
): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  const isManager = ctx.person.role.includes('manager') || ctx.person.role.includes('admin')
  const isTenant = ctx.person.role.includes('tenant')
  if (!isManager && !isTenant) {
    return { success: false, error: 'You do not have permission to update work orders.' }
  }

  // Fetch current work order
  const { data: wo, error: fetchErr } = await ctx.supabase
    .from('work_orders')
    .select('id, org_id, property_id, status, estimated_cost, assigned_vendor_id')
    .eq('id', workOrderId)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (fetchErr || !wo) return { success: false, error: 'Work order not found.' }

  // Validate transition using TRANSITIONS map
  const callerRole = isManager ? 'manager' : 'tenant'
  const validation = validateTransition(wo.status as never, newStatus as never, [callerRole])
  if (!validation.valid) return { success: false, error: validation.error ?? 'Invalid transition.' }

  // $500 gate: if assigning and estimated cost > 500, route to pending_approval
  let effectiveStatus = newStatus
  const estimatedCost = opts?.estimatedCost ?? (wo.estimated_cost as number | null) ?? 0
  if (newStatus === 'assigned' && estimatedCost > 500) {
    effectiveStatus = 'pending_approval'
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: any = { status: effectiveStatus }
  if (opts?.vendorId) updates.assigned_vendor_id = opts.vendorId
  if (opts?.estimatedCost !== undefined) updates.estimated_cost = opts.estimatedCost
  if (opts?.vendorCost !== undefined) updates.vendor_cost = opts.vendorCost
  if (opts?.billedAmount !== undefined) updates.billed_amount = opts.billedAmount

  const { error: updateErr } = await ctx.supabase
    .from('work_orders')
    .update(updates)
    .eq('id', workOrderId)
    .eq('org_id', ctx.person.org_id)

  if (updateErr) {
    console.error('[updateWorkOrderStatus] update error:', updateErr)
    return { success: false, error: 'Failed to update work order.' }
  }

  // Auto-create expense on completion (MAINT-09, D-14)
  if (effectiveStatus === 'completed' && opts?.vendorCost !== undefined) {
    await ctx.supabase.from('expenses').insert({
      org_id: ctx.person.org_id,
      property_id: wo.property_id,
      description: 'Work order completion',
      vendor_cost: opts.vendorCost,
      billed_amount: opts.billedAmount ?? opts.vendorCost,
      expense_date: new Date().toISOString().split('T')[0],
      created_by: ctx.person.id,
    })
  }

  // Notify owner if routed to pending_approval — fetch tokens needed for email links
  if (effectiveStatus === 'pending_approval') {
    const admin = createAdminClient()
    const { data: woFull } = await admin
      .from('work_orders')
      .select('owner_approve_token, owner_decline_token, estimated_cost')
      .eq('id', workOrderId)
      .single()
    if (woFull?.owner_approve_token && woFull?.owner_decline_token) {
      notifyOwnerPendingApproval(
        workOrderId,
        ctx.person.org_id,
        wo.property_id,
        woFull.estimated_cost ?? 0,
        woFull.owner_approve_token,
        woFull.owner_decline_token
      ).catch((e) => console.error('[updateWorkOrderStatus] owner notification failed:', e))
    }
  }

  revalidatePath('/maintenance')
  revalidatePath(`/maintenance/${workOrderId}`)
  return { success: true }
}

// --- updateViaVendorToken ---
// Called from vendor no-login page. Validates vendor_token server-side using admin client.
export async function updateViaVendorToken(
  vendorToken: string,
  newStatus: 'in_progress' | 'completed',
  invoiceAmount?: number
): Promise<ActionResult> {
  const admin = createAdminClient()

  const { data: wo, error } = await admin
    .from('work_orders')
    .select('id, org_id, property_id, status')
    .eq('vendor_token', vendorToken)
    .neq('status', 'closed')
    .single()

  if (error || !wo) return { success: false, error: 'This job link is no longer valid.' }

  const allowed = (wo.status === 'assigned' && newStatus === 'in_progress') ||
                  (wo.status === 'in_progress' && newStatus === 'completed')
  if (!allowed) return { success: false, error: 'This transition is not allowed from the current status.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: any = { status: newStatus }
  if (invoiceAmount !== undefined) updates.vendor_cost = invoiceAmount

  const { error: updateErr } = await admin
    .from('work_orders')
    .update(updates)
    .eq('id', wo.id)

  if (updateErr) return { success: false, error: 'Failed to update work order.' }

  // Auto-create expense when completed via vendor token
  if (newStatus === 'completed' && invoiceAmount !== undefined) {
    // Fetch a manager person_id to satisfy created_by NOT NULL constraint
    const { data: mgr } = await admin
      .from('people')
      .select('id')
      .eq('org_id', wo.org_id)
      .contains('role', ['manager'])
      .limit(1)
      .single()
    if (mgr) {
      await admin.from('expenses').insert({
        org_id: wo.org_id,
        property_id: wo.property_id,
        description: 'Work order completed by vendor',
        vendor_cost: invoiceAmount,
        billed_amount: invoiceAmount,
        expense_date: new Date().toISOString().split('T')[0],
        created_by: mgr.id,
      })
    }
  }

  return { success: true }
}

// --- declineWorkOrderViaToken ---
// Called from owner no-login decline page. Atomically transitions to closed + nullifies tokens.
export async function declineWorkOrderViaToken(
  declineToken: string,
  note?: string
): Promise<ActionResult> {
  const admin = createAdminClient()

  const { data: wo, error } = await admin
    .from('work_orders')
    .select('id, status')
    .eq('owner_decline_token', declineToken)
    .eq('status', 'pending_approval')
    .single()

  if (error || !wo) return { success: false, error: 'This decline link is expired or already used.' }

  const { error: updateErr } = await admin
    .from('work_orders')
    .update({
      status: 'closed',
      owner_decline_note: note ?? null,
      owner_approve_token: null,
      owner_decline_token: null,
    })
    .eq('id', wo.id)

  if (updateErr) return { success: false, error: 'Failed to decline work order.' }

  return { success: true }
}
