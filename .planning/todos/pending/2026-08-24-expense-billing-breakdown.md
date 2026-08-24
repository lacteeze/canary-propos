---
created: 2026-08-24T16:46:54.077Z
title: Add expense billing breakdown and org rate defaults
area: database
files:
  - supabase/migrations/0017_create_expenses.sql
  - src/components/payments/RecordExpenseDialog.tsx
  - src/app/actions/canary.ts
  - src/app/(manager)/payments/actions.ts
  - src/lib/billing/period-summary.ts
---

## Problem

Owner bill-backs are recorded as a single amount. Canary's real formula is:

- supplies cost (staff-only) × 30% markup
- labour hours × $50/hr (no markup)
- subtotal = marked-up supplies + labour (owner sees this)
- 15% HST on subtotal
- total after HST (owner sees this)

Receipts, markup, labour, cost, and notes must stay staff-only. `expenses` currently has only `vendor_cost` and `billed_amount`; `savePaymentEntry` writes the same number to both. Owner statements and SMS charge capture cannot be correct until the breakdown exists.

## Solution

1. Org settings (or constants with a settings row): markup 30%, labour $50/hr, HST 15%. Snapshot rates onto each expense.
2. Extend `expenses` with supplies cost, markup rate/amount, labour hours/rate/amount, subtotal, hst_amount, billed total, staff notes, created_by (already present). Keep D-11: owners/tenants never SELECT cost/markup/labour/notes.
3. Update Record Expense UI and Canary payment debit flow to enter supplies + hours (or explicit amounts) and compute subtotal/HST/total.
4. Owner-facing surfaces (statements, disbursement, period summary) show only subtotal + total (and category/label). Round each money line to cents.
