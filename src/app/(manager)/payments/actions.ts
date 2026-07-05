'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// --- Action result type ---
export type ActionResult =
  | { success: true }
  | { success: false; error: string }

// --- Helper: resolve the caller's org + role + id ---
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

// --- recordPayment ---
const recordPaymentSchema = z.object({
  lease_id: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['etransfer', 'cheque', 'cash', 'bank_transfer']),
  payment_date: z.string(), // ISO date string
  notes: z.string().optional(),
})

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>

export async function recordPayment(formData: RecordPaymentInput): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) {
    return { success: false, error: 'You must be signed in.' }
  }

  // Authz: only manager or admin
  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can record payments.' }
  }

  const parsed = recordPaymentSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { lease_id, amount, method, payment_date, notes } = parsed.data

  // T-04-12: Verify lease belongs to caller's org
  const { data: lease, error: leaseError } = await ctx.supabase
    .from('leases')
    .select('id')
    .eq('id', lease_id)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (leaseError || !lease) {
    return { success: false, error: 'Lease not found in your organization.' }
  }

  const { error: insertError } = await ctx.supabase
    .from('payments')
    .insert({
      org_id: ctx.person.org_id,
      lease_id,
      amount,
      method,
      status: 'recorded',
      recorded_by: ctx.person.id,
      notes: notes ?? null,
      created_at: payment_date,
    })

  if (insertError) {
    return { success: false, error: insertError.message }
  }

  revalidatePath('/payments')
  return { success: true }
}

// --- recordExpense ---
const recordExpenseSchema = z.object({
  property_id: z.string().uuid(),
  description: z.string().min(1),
  vendor_cost: z.number().min(0),
  billed_amount: z.number().min(0),
  expense_date: z.string(), // ISO date string
})

export type RecordExpenseInput = z.infer<typeof recordExpenseSchema>

export async function recordExpense(formData: RecordExpenseInput): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) {
    return { success: false, error: 'You must be signed in.' }
  }

  // Authz: only manager or admin
  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can record expenses.' }
  }

  const parsed = recordExpenseSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { property_id, description, vendor_cost, billed_amount, expense_date } = parsed.data

  // T-04-13: Verify property belongs to caller's org
  const { data: property, error: propertyError } = await ctx.supabase
    .from('properties')
    .select('id')
    .eq('id', property_id)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (propertyError || !property) {
    return { success: false, error: 'Property not found in your organization.' }
  }

  const { error: insertError } = await ctx.supabase
    .from('expenses')
    .insert({
      org_id: ctx.person.org_id,
      property_id,
      description,
      vendor_cost,
      billed_amount,
      expense_date,
      created_by: ctx.person.id,
    })

  if (insertError) {
    return { success: false, error: insertError.message }
  }

  revalidatePath('/payments')
  return { success: true }
}
