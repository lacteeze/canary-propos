export const DEFAULT_EXPENSE_RATES = {
  markupRate: 0.3,
  labourRate: 50,
  hstRate: 0.15,
} as const

export type OrgRates = {
  markupRate: number
  labourRate: number
  hstRate: number
}

export type ExpenseBillingInput = {
  suppliesCost: number
  labourHours: number
  rates: OrgRates
}

export type ExpenseBillingResult = {
  suppliesMarkedUp: number
  labourAmount: number
  subtotal: number
  hstAmount: number
  total: number
  markupAmount: number
}

/** Banker's-safe cent rounding: 1.005 → 1.01 */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Locked Canary bill-back formula (D-04).
 * supplies_marked_up = round(supplies_cost × (1 + markupRate), 2)
 * labour = round(hours × labourRate, 2)
 * subtotal = marked-up + labour
 * hst = round(subtotal × hstRate, 2)
 * total = subtotal + hst
 */
export function computeExpenseBilling(input: ExpenseBillingInput): ExpenseBillingResult {
  const suppliesCost = round2(input.suppliesCost)
  const suppliesMarkedUp = round2(suppliesCost * (1 + input.rates.markupRate))
  const labourAmount = round2(input.labourHours * input.rates.labourRate)
  const subtotal = round2(suppliesMarkedUp + labourAmount)
  const hstAmount = round2(subtotal * input.rates.hstRate)
  const total = round2(subtotal + hstAmount)
  const markupAmount = round2(suppliesMarkedUp - suppliesCost)
  return {
    suppliesMarkedUp,
    labourAmount,
    subtotal,
    hstAmount,
    total,
    markupAmount,
  }
}

export type ExpenseBillingSnapshot = {
  supplies_cost: number
  vendor_cost: number
  markup_rate: number
  markup_amount: number
  labour_hours: number
  labour_rate: number
  labour_amount: number
  subtotal: number
  hst_rate: number
  hst_amount: number
  billed_amount: number
  source_channel: 'manual' | 'sms' | 'work_order'
}

export function snapshotExpenseBilling(input: {
  suppliesCost: number
  labourHours: number
  rates: OrgRates
  sourceChannel: 'manual' | 'sms'
}): ExpenseBillingSnapshot {
  const billing = computeExpenseBilling(input)
  const suppliesCost = round2(input.suppliesCost)
  return {
    supplies_cost: suppliesCost,
    vendor_cost: suppliesCost,
    markup_rate: input.rates.markupRate,
    markup_amount: billing.markupAmount,
    labour_hours: round2(input.labourHours),
    labour_rate: input.rates.labourRate,
    labour_amount: billing.labourAmount,
    subtotal: billing.subtotal,
    hst_rate: input.rates.hstRate,
    hst_amount: billing.hstAmount,
    billed_amount: billing.total,
    source_channel: input.sourceChannel,
  }
}

/** Work-order completion: passthrough billed amount, no D-04 markup/HST. */
export function snapshotWorkOrderExpense(
  vendorCost: number,
  billedAmount: number
): ExpenseBillingSnapshot {
  return {
    supplies_cost: vendorCost,
    vendor_cost: vendorCost,
    markup_rate: 0,
    markup_amount: 0,
    labour_hours: 0,
    labour_rate: 0,
    labour_amount: 0,
    subtotal: billedAmount,
    hst_rate: 0,
    hst_amount: 0,
    billed_amount: billedAmount,
    source_channel: 'work_order',
  }
}
