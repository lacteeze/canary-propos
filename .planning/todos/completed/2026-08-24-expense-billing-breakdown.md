---
created: 2026-08-24T16:46:54.077Z
completed: 2026-08-24
title: Add expense billing breakdown and org rate defaults
area: database
shipped_in: 260824-jzb
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

Shipped in quick task 260824-jzb (migration 0057 + `computeExpenseBilling`).
