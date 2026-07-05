// src/app/(manager)/payments/disbursement/[propertyId]/page.tsx
// Manager disbursement view — shows rent collected, billed expenses, management fee,
// net to owner, and lets the manager generate an immutable PDF statement.
//
// SECURITY: vendor_cost is never rendered here (T-04-17).

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { calculateDisbursement } from '@/app/(manager)/payments/disbursement/actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DisbursementActions } from '@/components/payments/DisbursementActions'

// ---------------------------------------------------------------------------
// Page props
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ propertyId: string }>
  searchParams: Promise<{ year?: string; month?: string }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatCAD(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount)
}

// ---------------------------------------------------------------------------
// Page component (Server Component)
// ---------------------------------------------------------------------------

export default async function DisbursementPage({ params, searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { propertyId } = await params
  const sp = await searchParams

  const now = new Date()
  const year = sp.year ? parseInt(sp.year, 10) : now.getFullYear()
  const month = sp.month ? parseInt(sp.month, 10) : now.getMonth() + 1

  // Validate parsed values
  const safeYear = isNaN(year) || year < 2020 || year > 2100 ? now.getFullYear() : year
  const safeMonth = isNaN(month) || month < 1 || month > 12 ? now.getMonth() + 1 : month

  const result = await calculateDisbursement(propertyId, safeYear, safeMonth)

  if (!result.success) {
    return (
      <div className="p-6">
        <p className="text-red-600">{result.error}</p>
      </div>
    )
  }

  const summary = result.data!

  // Build year options: 2 years ago through current year
  const currentYear = now.getFullYear()
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear]

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">{summary.propertyAddress}</h1>
        <p className="text-sm text-stone-500 mt-1">Owner: {summary.ownerName}</p>
      </div>

      {/* Period selector — client component handles form navigation */}
      <DisbursementActions
        propertyId={propertyId}
        selectedYear={safeYear}
        selectedMonth={safeMonth}
        yearOptions={yearOptions}
        statementAlreadyExists={summary.statementAlreadyExists}
      />

      {/* Disbursement Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {MONTH_NAMES[safeMonth - 1]} {safeYear} — Disbursement Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-stone-100">
            <div className="flex justify-between py-3">
              <span className="text-sm text-stone-600">Rent Collected</span>
              <span className="text-sm font-medium text-stone-900">{formatCAD(summary.rentCollected)}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-sm text-stone-600">Total Expenses (Billed)</span>
              <span className="text-sm font-medium text-stone-900">
                -{formatCAD(summary.expenses.reduce((s, e) => s + e.billedAmount, 0))}
              </span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-sm text-stone-600">{summary.managementFeeLabel}</span>
              <span className="text-sm font-medium text-stone-900">-{formatCAD(summary.managementFee)}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-sm font-semibold text-stone-900">Net to Owner</span>
              <span className="text-base font-bold text-stone-900">{formatCAD(summary.netToOwner)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses detail — billed_amount ONLY, vendor_cost intentionally excluded */}
      {summary.expenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Detail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="text-left py-2 pr-4 text-stone-500 font-medium">Description</th>
                    <th className="text-right py-2 text-stone-500 font-medium">Billed Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {summary.expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td className="py-2 pr-4 text-stone-700">{expense.description}</td>
                      <td className="py-2 text-right text-stone-700">{formatCAD(expense.billedAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
