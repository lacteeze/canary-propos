'use server'

// src/app/(manager)/payments/disbursement/actions.ts
// Server action: calculateDisbursement — computes rent collected, billed expenses,
// management fee, and net-to-owner for a given property + month.
//
// SECURITY: expenses SELECT never includes vendor_cost (T-04-17).
// Org isolation: property.org_id verified against caller's org before data access (T-04-18).

import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Shared ActionResult type (mirrors pattern from people/actions.ts)
// ---------------------------------------------------------------------------

export type ActionResult =
  | { success: true }
  | { success: false; error: string }

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DisbursementExpense {
  id: string
  description: string
  billedAmount: number
}

export interface DisbursementSummary {
  propertyAddress: string
  ownerName: string
  orgName: string
  rentCollected: number
  expenses: DisbursementExpense[]
  managementFeeType: 'percent' | 'flat' | null
  managementFeeValue: number | null
  managementFee: number
  managementFeeLabel: string
  netToOwner: number
  statementAlreadyExists: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateManagementFee(
  rentCollected: number,
  feeType: 'percent' | 'flat' | null,
  feeValue: number | null
): number {
  if (!feeType || feeValue === null || feeValue === undefined) return 0
  if (feeType === 'percent') return rentCollected * (feeValue / 100)
  return feeValue // flat
}

function buildManagementFeeLabel(
  feeType: 'percent' | 'flat' | null,
  feeValue: number | null
): string {
  if (!feeType || feeValue === null || feeValue === undefined) return 'Management Fee'
  if (feeType === 'percent') return `Management Fee (${feeValue}%)`
  return `Management Fee (flat $${feeValue.toFixed(2)})`
}

function monthDateRange(year: number, month: number): { start: string; end: string } {
  // First day of month
  const start = new Date(year, month - 1, 1)
  // First day of next month (exclusive upper bound for BETWEEN)
  const end = new Date(year, month, 1)
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export type DisbursementResult =
  | { success: true; data: DisbursementSummary }
  | { success: false; error: string }

export async function calculateDisbursement(
  propertyId: string,
  year: number,
  month: number
): Promise<DisbursementResult> {
  const supabase = await createClient()

  // 1. Verify caller is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: callerPerson } = await supabase
    .from('people')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!callerPerson) return { success: false, error: 'Not authenticated' }

  const isManager =
    callerPerson.role.includes('manager') || callerPerson.role.includes('admin')
  if (!isManager) return { success: false, error: 'Insufficient permissions' }

  // 2. Load property and verify org membership (T-04-18)
  // Note: management_fee_type and management_fee_value are added via 04-01 migration;
  // they are not yet in the generated supabase.ts types so we cast via any.
  const { data: property, error: propertyError } = await (supabase
    .from('properties')
    .select('id, street_address, city, province, org_id, owner_id, management_fee_type, management_fee_value') as any)
    .eq('id', propertyId)
    .eq('org_id', callerPerson.org_id)
    .single()

  if (propertyError || !property) {
    return { success: false, error: 'Property not found or access denied' }
  }

  // 3. Compute date range
  const { start, end } = monthDateRange(year, month)

  // 4. Sum cleared payments for leases belonging to this property in the date range.
  //    payments table: lease_id, amount, status, created_at
  //    leases table: id, property_id (via units -> properties or direct? Check schema)
  //    Phase 4 adds: payments.status = 'cleared', payments.cleared_at
  //
  //    Using direct Postgres RPC approach via supabase — join via units
  // payments links to leases → units → properties; no direct property_id column
  const { data: paymentData } = await supabase
    .from('payments')
    .select('amount, leases!inner(units!inner(property_id))')
    .eq('org_id', callerPerson.org_id)
    .eq('leases.units.property_id', propertyId)
    .eq('status', 'cleared')
    .gte('cleared_at', start)
    .lt('cleared_at', end)

  const rentCollected: number = paymentData
    ? (paymentData as Array<{ amount: number }>).reduce((sum, p) => sum + (p.amount ?? 0), 0)
    : 0

  // 5. Load expenses for this property — billed_amount ONLY, never vendor_cost (T-04-17)
  const { data: expenseData } = await (supabase
    .from('expenses')
    .select('id, description, billed_amount') as any)
    .eq('org_id', callerPerson.org_id)
    .eq('property_id', propertyId)
    .gte('expense_date', start.split('T')[0])
    .lt('expense_date', end.split('T')[0])

  const expenses: DisbursementExpense[] = expenseData
    ? (expenseData as Array<{ id: string; description: string; billed_amount: number }>).map(
        (e) => ({
          id: e.id,
          description: e.description,
          billedAmount: e.billed_amount ?? 0,
        })
      )
    : []

  // 6. Load owner name
  let ownerName = 'Unknown Owner'
  if (property.owner_id) {
    const { data: owner } = await supabase
      .from('people')
      .select('first_name, last_name')
      .eq('id', property.owner_id)
      .single()
    if (owner) {
      ownerName = `${owner.first_name ?? ''} ${owner.last_name ?? ''}`.trim() || ownerName
    }
  }

  // 7. Load org name
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', callerPerson.org_id)
    .single()
  const orgName = org?.name ?? 'Unknown Organization'

  // 8. Calculate management fee
  const feeType = (property.management_fee_type as 'percent' | 'flat' | null) ?? null
  const feeValue = (property.management_fee_value as number | null) ?? null
  const managementFee = calculateManagementFee(rentCollected, feeType, feeValue)
  const managementFeeLabel = buildManagementFeeLabel(feeType, feeValue)

  // 9. Net to owner
  const totalBilledExpenses = expenses.reduce((sum, e) => sum + e.billedAmount, 0)
  const netToOwner = rentCollected - totalBilledExpenses - managementFee

  // 10. Check if statement already exists
  const { data: existingStatement } = await (supabase
    .from('owner_statements')
    .select('id') as any)
    .eq('property_id', propertyId)
    .eq('period_year', year)
    .eq('period_month', month)
    .eq('org_id', callerPerson.org_id)
    .maybeSingle()

  const propertyAddress = `${property.street_address}, ${property.city}, ${property.province}`

  return {
    success: true as const,
    data: {
      propertyAddress,
      ownerName,
      orgName,
      rentCollected,
      expenses,
      managementFeeType: feeType,
      managementFeeValue: feeValue,
      managementFee,
      managementFeeLabel,
      netToOwner,
      statementAlreadyExists: !!existingStatement,
    },
  }
}
