---
id: SEED-001
status: harvested
planted: 2026-08-24
planted_during: unknown
trigger_when: when expense billing breakdown (supplies, labour, HST) exists
scope: large
---

# SEED-001: SMS charge capture with confirm-and-learn

Staff (and Aaron) text one shared number. The app infers property + date, applies org billing defaults, texts back a draft, and posts the owner bill-back only after **Y**. Incoming numbers map to staff users. Confirmed posts teach later shorthand ("Airbnb Restock").

## Why This Matters

Managers record restocks and similar jobs from the field. Opening the app to pick a property, split cost vs labour, and add HST is slower than a text they already want to send. The current expense row cannot represent the real Canary formula, so SMS capture would post the wrong owner amount if built first.

## When to Surface

**Trigger:** when expense billing breakdown (supplies, labour, HST) exists

Also relevant when touching Pingram inbound webhooks, staff phone numbers, or owner statements.

## Scope Estimate

**Large** — a phase: dedicated Pingram CA number, inbound webhook, LLM/structured parse, draft+confirm SMS, MMS receipts to private storage, staff UI showing who posted, learning from confirmed notes. Do not start until the expense model todo is done.

## Breadcrumbs

- `src/lib/work-orders/sms.ts` — existing Pingram CA outbound SMS + E.164 helper
- `supabase/migrations/0017_create_expenses.sql` — expenses table; D-11 vendor_cost privacy
- `src/app/actions/canary.ts` — `savePaymentEntry` debit → expenses
- `src/components/payments/RecordExpenseDialog.tsx` — vendor_cost / billed_amount UI
- `src/lib/billing/period-summary.ts` — owner-facing billed_amount only
- `people.phone` — sender identity
- Pingram docs: inbound SMS/MMS webhooks (`SMS_INBOUND`), dedicated A2P number

## Notes

Captured from `/gsd:explore` 2026-08-24. Design decisions are in `.planning/notes/2026-08-24-sms-charge-capture-design.md`. Prerequisite todo: `.planning/todos/pending/2026-08-24-expense-billing-breakdown.md`.
