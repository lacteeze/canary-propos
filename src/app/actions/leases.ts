'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) return null
  return { supabase, user, person }
}

// --- Schemas ---

const createLeaseSchema = z.object({
  unit_id: z.string().uuid('Invalid unit ID'),
  tenant_id: z.string().uuid('Invalid tenant ID'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid start date'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid end date'),
  monthly_rent: z.number().positive('Monthly rent must be positive'),
  deposit_amount: z.number().min(0, 'Deposit amount must be 0 or greater'),
  rent_due_day: z.number().int().min(1).max(28),
  document_path: z.string().optional(),
})

const renewalSchema = z.object({
  renewal_status: z.enum(['pending', 'sent', 'accepted', 'declined']),
  proposed_rent: z.number().positive().optional(),
})

// --- createLease ---
export async function createLease(data: {
  unit_id: string
  tenant_id: string
  start_date: string
  end_date: string
  monthly_rent: number
  deposit_amount: number
  rent_due_day: number
  document_path?: string
}): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  if (!ctx.person.role.includes('manager') && !ctx.person.role.includes('admin')) {
    return { success: false, error: 'Only managers can create leases.' }
  }

  const parsed = createLeaseSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { unit_id, tenant_id, start_date, end_date, monthly_rent, deposit_amount, rent_due_day, document_path } = parsed.data

  // Verify unit belongs to caller's org (T-02-15)
  const { data: unit, error: unitError } = await ctx.supabase
    .from('units')
    .select('id, org_id')
    .eq('id', unit_id)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (unitError || !unit) {
    return { success: false, error: 'Unit not found in your organization.' }
  }

  // Verify tenant belongs to caller's org
  const { data: tenant, error: tenantError } = await ctx.supabase
    .from('people')
    .select('id')
    .eq('id', tenant_id)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (tenantError || !tenant) {
    return { success: false, error: 'Tenant not found in your organization.' }
  }

  const { data: newLease, error: insertError } = await ctx.supabase
    .from('leases')
    .insert({
      org_id: ctx.person.org_id,
      unit_id,
      tenant_id,
      start_date,
      end_date,
      monthly_rent,
      deposit_amount,
      rent_due_day,
      document_path: document_path ?? null,
      status: 'active',
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[createLease] insert error:', insertError)
    return { success: false, error: 'Failed to create lease. Please try again.' }
  }

  // Update unit status to occupied
  await ctx.supabase
    .from('units')
    .update({ status: 'occupied' })
    .eq('id', unit_id)

  revalidatePath('/leases')
  return { success: true, id: newLease.id }
}

// --- updateLeaseRenewal ---
export async function updateLeaseRenewal(
  leaseId: string,
  data: { renewal_status: 'pending' | 'sent' | 'accepted' | 'declined'; proposed_rent?: number }
): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  if (!ctx.person.role.includes('manager') && !ctx.person.role.includes('admin')) {
    return { success: false, error: 'Only managers can update lease renewals.' }
  }

  const parsed = renewalSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  // Verify lease ownership via org_id
  const { data: lease, error: fetchError } = await ctx.supabase
    .from('leases')
    .select('id')
    .eq('id', leaseId)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (fetchError || !lease) {
    return { success: false, error: 'Lease not found in your organization.' }
  }

  const { error: updateError } = await ctx.supabase
    .from('leases')
    .update({
      renewal_status: parsed.data.renewal_status,
      proposed_rent: parsed.data.proposed_rent ?? null,
    })
    .eq('id', leaseId)

  if (updateError) {
    console.error('[updateLeaseRenewal] update error:', updateError)
    return { success: false, error: 'Failed to update renewal status. Please try again.' }
  }

  revalidatePath('/leases/' + leaseId)
  return { success: true }
}

// --- updateLeaseDocumentPath ---
export async function updateLeaseDocumentPath(
  leaseId: string,
  documentPath: string
): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  if (!ctx.person.role.includes('manager') && !ctx.person.role.includes('admin')) {
    return { success: false, error: 'Only managers can update lease documents.' }
  }

  // Verify lease ownership via org_id
  const { data: lease, error: fetchError } = await ctx.supabase
    .from('leases')
    .select('id')
    .eq('id', leaseId)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (fetchError || !lease) {
    return { success: false, error: 'Lease not found in your organization.' }
  }

  const { error: updateError } = await ctx.supabase
    .from('leases')
    .update({ document_path: documentPath })
    .eq('id', leaseId)

  if (updateError) {
    console.error('[updateLeaseDocumentPath] update error:', updateError)
    return { success: false, error: 'Failed to update document path. Please try again.' }
  }

  revalidatePath('/leases/' + leaseId)
  return { success: true }
}

// --- generateLeaseDownloadUrl ---
// Called by BOTH managers and tenants. No explicit role check — RLS on leases table gates access.
// T-02-13: RLS ensures tenant sees only their own lease. T-02-14: 60-second signed URL.
export async function generateLeaseDownloadUrl(leaseId: string): Promise<string | null> {
  const supabase = await createClient()

  // Fetch lease — RLS applies (tenant sees own, manager sees org)
  const { data: lease, error } = await supabase
    .from('leases')
    .select('document_path')
    .eq('id', leaseId)
    .single()

  if (error || !lease || !lease.document_path) {
    return null
  }

  // 60-second signed URL (T-02-14 — security-critical short expiry)
  const { data: signedData, error: signedError } = await supabase.storage
    .from('org-assets')
    .createSignedUrl(lease.document_path, 60)

  if (signedError || !signedData?.signedUrl) {
    console.error('[generateLeaseDownloadUrl] signed URL error:', signedError)
    return null
  }

  return signedData.signedUrl
}
