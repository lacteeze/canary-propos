---
status: complete
phase: 260824-jzb-implement-sms-charge-capture-expense-bil
plan: 01
subsystem: payments
tags: [sms, pingram, expenses, billing, hst, supabase, nextjs]

requires:
  - phase: existing-platform
    provides: expenses table, Pingram outbound, owner statements, Canary payments ledger
provides:
  - Snapshotted expense billing (supplies × 1.30 + hours × $50 + 15% HST)
  - Owner-visible subtotal + total only
  - Pingram SMS_INBOUND webhook with Y/N confirm
  - Private MMS receipts and phrase learning
affects: [owner-statements, disbursement, canary-payments, pingram]

tech-stack:
  added: []
  patterns:
    - computeExpenseBilling before every manual/SMS expense write
    - Work-order expenses passthrough (no D-04 markup/HST)
    - Pingram webhook: raw body + verify() then handleInboundSms
    - Unknown inbound numbers ignored with no reply

key-files:
  created:
    - supabase/migrations/0057_expense_billing_and_sms_capture.sql
    - src/lib/billing/expense-breakdown.ts
    - src/lib/sms/charge-capture.ts
    - src/app/api/pingram/webhook/route.ts
    - src/lib/sms/learn-phrase.ts
  modified:
    - src/app/(manager)/payments/actions.ts
    - src/app/actions/canary.ts
    - src/components/payments/StatementPDF.tsx
    - src/lib/canary/load-db.ts

key-decisions:
  - "Locked formula: supplies × 1.30 + hours × $50, then 15% HST; round each money line to cents"
  - "Never auto-post inferred amounts; Y posts, N cancels"
  - "pingram_webhook_events has RLS on and no user policies (service role only, like stripe_events)"
  - "Optional AI parse only when AI_GATEWAY_API_KEY is set (not merely VERCEL)"

patterns-established:
  - "Owner SELECTs are id, description, billed_amount, subtotal, expense_date only"
  - "Receipts at org-assets/{org_id}/expense-receipts/{draft_id}/"

requirements-completed: [EXP-01, EXP-02, SMS-01, SMS-02, SMS-03, SMS-04]

duration: 12min
completed: 2026-08-24
---

# Phase 260824-jzb Plan 01: SMS charge capture + expense billing Summary

**Staff bill-backs snapshot supplies×1.30 + hours×$50 + 15% HST; owners see subtotal and total only; known staff phones draft via Pingram SMS and post only on Y.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-24T16:58:39Z
- **Completed:** 2026-08-24T17:10:41Z
- **Tasks:** 3
- **Files modified:** 32

## Accomplishments

- Expenses persist snapshotted markup 30%, labour $50/hr, 15% HST; `billed_amount` is owner total after HST; `vendor_cost` stays in sync with `supplies_cost` (D-11).
- Manual Record Expense and Canary debit writes take supplies + hours; work-order completion rows stay passthrough (no silent markup/HST).
- Owner PDF, disbursement, and period summary render Description / Subtotal / Total only.
- `/api/pingram/webhook` verifies Pingram signatures, ignores unknown numbers, texts a draft, posts on Y, cancels on N, asks Reply 1 or 2 when the property is ambiguous.
- Confirmed notes learn shorthand; MMS receipts go to private `org-assets/.../expense-receipts`; Canary debit cards show poster + original SMS.

## Task Commits

Each task was committed atomically:

1. **Task 1: Expense billing breakdown** — `638235f` (test) then `0ad80c9` (feat)
2. **Task 2: Pingram inbound webhook + Y/N** — `36c4ab6` (feat)
3. **Task 3: Receipts, phrase learning, staff ledger** — `70f513b` (feat)

**Plan metadata:** not committed here (orchestrator docs commit)

## Files Created/Modified

- `supabase/migrations/0057_expense_billing_and_sms_capture.sql` — org rates, expense breakdown, drafts/phrases/receipts/webhook events, staff-only RLS
- `src/lib/billing/expense-breakdown.ts` — locked formula + snapshot helpers
- `src/app/(manager)/payments/actions.ts` — `recordExpense` computes billed total server-side
- `src/components/payments/RecordExpenseDialog.tsx` — supplies + hours + read-only preview
- `src/app/actions/canary.ts` — debit path uses supplies/hours, ignores old amount as billed total
- `src/app/actions/work-orders.ts` — passthrough snapshot on completion
- `src/components/payments/StatementPDF.tsx` — Subtotal + Total columns
- `src/app/api/pingram/webhook/route.ts` — Node runtime, `verify` from `pingram/webhooks`
- `src/lib/sms/charge-capture.ts` — staff identity, draft, Y/N, MMS attach
- `src/lib/sms/learn-phrase.ts` — normalize + upsert after confirmed Y
- `src/lib/canary/load-db.ts` — staff ledger fields (postedBy, sourceSms, receipts)

## Decisions Made

- Followed locked D-01–D-09 as specified.
- `pingram_webhook_events` has no `org_id`, so RLS is enabled with no authenticated policies (service role via `createAdminClient` only).
- Optional AI parse is skipped unless `AI_GATEWAY_API_KEY` is set, so a `VERCEL` env flag cannot trigger outbound AI during tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Webhook idempotency table is service-role only**
- **Found during:** Task 1 (migration)
- **Issue:** `pingram_webhook_events` has no `org_id`, so a manager/admin `org_id = public.org_id()` policy cannot apply without leaking cross-org event ids.
- **Fix:** ENABLE RLS with no user policies (same spirit as `stripe_events`).
- **Files modified:** `supabase/migrations/0057_expense_billing_and_sms_capture.sql`
- **Committed in:** `0ad80c9`

**2. [Rule 1 - Bug] Isolate CanaryApp / load-db / types / .env.example from unrelated WIP**
- **Found during:** Task 1–3 commits
- **Issue:** Working tree had uncommitted sidebar/social/Meta changes mixed into files this plan touches.
- **Fix:** Restored HEAD, applied only plan edits, committed, then restored the user's WIP on top.
- **Files modified:** commit snapshots only; WIP restored after each commit
- **Committed in:** `0ad80c9`, `36c4ab6`, `70f513b`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking isolation)
**Impact on plan:** Required for security and to avoid committing unrelated WIP. No scope creep.

Task 2 did not use a separate RED-only commit (tests and implementation landed together in `36c4ab6`). Task 1 RED commit exists (`638235f`).

## Issues Encountered

- `node_modules/next/dist/docs/` is not present in this install. Route handler follows existing `src/app/api/stripe/webhook/route.ts` and `src/app/api/meta/webhook/route.ts` (App Router, `runtime = 'nodejs'`, `req.text()` first).
- Next.js is 16.2.9 in package.json; no Pages Router APIs were used.

## User Setup Required

**External services require manual configuration (human-only).**

1. **Pingram Dashboard (region ca)**
   - Set Events Webhook URL to `https://<host>/api/pingram/webhook`
   - Enable `SMS_INBOUND` (SMS_UNSUBSCRIBE can be ignored)
   - Copy webhook secret into `PINGRAM_WEBHOOK_SECRET`
   - Set `PINGRAM_INBOUND_NUMBER` to the shared Canary inbox number (E.164)
   - Allow notification type `sms_charge_capture` for outbound draft/confirm SMS
2. **Local Supabase:** apply migration `0057` (`supabase db push` / migration up) before testing SMS posting
3. **People:** each staff sender needs `people.phone` set (manager/employee/admin, active)

**Ops note (not a code TODO):** unsolicited first inbound SMS may depend on Pingram dedicated-number inbox; Y as a reply is inside the 7-day window. If first messages never arrive in production, that is an ops follow-up, not a webhook skip.

## Next Phase Readiness

- Code path is complete for EXP-01/02 and SMS-01–04.
- Blocked on Pingram dashboard webhook + number + `sms_charge_capture` type, and applying migration 0057 locally.

## Self-Check: PASSED

- FOUND: `supabase/migrations/0057_expense_billing_and_sms_capture.sql`
- FOUND: `src/lib/billing/expense-breakdown.ts`
- FOUND: `src/app/api/pingram/webhook/route.ts`
- FOUND: `src/lib/sms/charge-capture.ts`
- FOUND: `src/lib/sms/learn-phrase.ts`
- FOUND: `src/components/payments/StatementPDF.tsx`
- FOUND: `638235f`, `0ad80c9`, `36c4ab6`, `70f513b`

---
*Phase: 260824-jzb-implement-sms-charge-capture-expense-bil*
*Completed: 2026-08-24*
