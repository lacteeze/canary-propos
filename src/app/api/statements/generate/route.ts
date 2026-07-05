// src/app/api/statements/generate/route.ts
// POST /api/statements/generate — generates an immutable owner statement PDF.
//
// Flow:
//   1. Authenticate caller (manager/admin)
//   2. Call calculateDisbursement to get period data
//   3. Render PDF via renderToBuffer (Node.js only — NOT Edge)
//   4. Upload to org-assets bucket with upsert:false (immutability — T-04-16)
//   5. Insert row into owner_statements table
//
// SECURITY:
//   T-04-16: upsert:false prevents overwriting historical statements.
//   T-04-17: StatementPDF component never references vendor_cost.
//   T-04-18: calculateDisbursement verifies property.org_id = caller's org.
//   T-04-19: export const runtime = 'nodejs' prevents Edge deployment.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateDisbursement } from '@/app/(manager)/payments/disbursement/actions'
import { StatementPDF } from '@/components/payments/StatementPDF'
import type { StatementData } from '@/components/payments/StatementPDF'

// Must run in Node.js runtime — renderToBuffer requires Node (T-04-19)
export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  property_id: z.string().uuid('Invalid property_id'),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
})

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Verify caller is authenticated
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: callerPerson } = await supabase
    .from('people')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!callerPerson) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const isManager =
    callerPerson.role.includes('manager') || callerPerson.role.includes('admin')
  if (!isManager) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  // 2. Validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    )
  }

  const { property_id, year, month } = parsed.data

  // 3. Calculate disbursement (includes org isolation check)
  const result = await calculateDisbursement(property_id, year, month)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  if (!result.data) {
    return NextResponse.json({ error: 'No disbursement data returned' }, { status: 500 })
  }
  const summary = result.data

  // 4. If statement already exists, return 409 — do not regenerate (T-04-16)
  if (summary.statementAlreadyExists) {
    return NextResponse.json(
      { error: 'Statement already exists for this period' },
      { status: 409 }
    )
  }

  // 5. Build StatementData for PDF render
  const statementData: StatementData = {
    orgName: summary.orgName,
    propertyAddress: summary.propertyAddress,
    ownerName: summary.ownerName,
    periodYear: year,
    periodMonth: month,
    rentCollected: summary.rentCollected,
    expenses: summary.expenses.map((e) => ({
      description: e.description,
      billedAmount: e.billedAmount,
    })),
    managementFeeLabel: summary.managementFeeLabel,
    managementFee: summary.managementFee,
    netToOwner: summary.netToOwner,
  }

  // 6. Render PDF server-side — Node.js runtime required
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      React.createElement(StatementPDF, { statement: statementData }) as any
    )
  } catch (err) {
    console.error('[statements/generate] renderToBuffer error:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }

  // 7. Upload to Supabase Storage with upsert:false (immutability guarantee — T-04-16)
  const admin = createAdminClient()
  const monthStr = String(month).padStart(2, '0')
  const storagePath = `statements/${property_id}/${year}-${monthStr}.pdf`

  const { error: uploadError } = await admin.storage
    .from('org-assets')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false, // CRITICAL: never overwrite historical statements (T-04-16)
    })

  if (uploadError) {
    // Storage returns an error if the file already exists when upsert:false
    const msg = (uploadError as { message?: string }).message ?? ''
    if (
      msg.toLowerCase().includes('already exists') ||
      msg.toLowerCase().includes('duplicate') ||
      msg.toLowerCase().includes('violates') ||
      (uploadError as { statusCode?: string }).statusCode === '409'
    ) {
      return NextResponse.json(
        { error: 'Statement already exists for this period' },
        { status: 409 }
      )
    }
    console.error('[statements/generate] storage upload error:', uploadError)
    return NextResponse.json({ error: 'Failed to store statement' }, { status: 500 })
  }

  // 8. Insert owner_statements row
  const totalExpenses = summary.expenses.reduce((sum, e) => sum + e.billedAmount, 0)

  const { error: insertError } = await (admin
    .from('owner_statements')
    .insert({
      org_id: callerPerson.org_id,
      property_id,
      period_year: year,
      period_month: month,
      pdf_path: storagePath,
      rent_collected: summary.rentCollected,
      total_expenses: totalExpenses,
      management_fee: summary.managementFee,
      net_to_owner: summary.netToOwner,
      generated_by: callerPerson.id,
    }) as any)

  if (insertError) {
    console.error('[statements/generate] owner_statements insert error:', insertError)
    // PDF was uploaded but row insert failed — log for manual reconciliation
    return NextResponse.json({ error: 'Statement stored but record insert failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true, pdf_path: storagePath })
}
