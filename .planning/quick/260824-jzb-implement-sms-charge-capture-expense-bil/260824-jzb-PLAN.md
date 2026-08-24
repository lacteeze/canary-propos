---
phase: 260824-jzb-implement-sms-charge-capture-expense-bil
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/0057_expense_billing_and_sms_capture.sql
  - src/lib/billing/expense-breakdown.ts
  - src/lib/billing/expense-breakdown.test.ts
  - src/types/supabase.ts
  - src/app/(manager)/payments/actions.ts
  - src/components/payments/RecordExpenseDialog.tsx
  - src/app/actions/canary.ts
  - src/app/actions/work-orders.ts
  - src/lib/canary/types.ts
  - src/lib/canary/load-db.ts
  - src/components/canary/CanaryApp.tsx
  - src/lib/billing/period-summary.ts
  - src/app/(manager)/payments/disbursement/actions.ts
  - src/app/(manager)/payments/disbursement/[propertyId]/page.tsx
  - src/components/payments/StatementPDF.tsx
  - src/app/api/statements/generate/route.ts
  - src/app/api/statements/export/route.ts
  - src/lib/work-orders/sms.ts
  - src/lib/sms/e164.ts
  - src/lib/sms/pingram-send.ts
  - src/lib/sms/match-property.ts
  - src/lib/sms/match-property.test.ts
  - src/lib/sms/parse-charge-note.ts
  - src/lib/sms/parse-charge-note.test.ts
  - src/lib/sms/learn-phrase.ts
  - src/lib/sms/learn-phrase.test.ts
  - src/lib/sms/charge-capture.ts
  - src/lib/sms/charge-capture.test.ts
  - src/app/api/pingram/webhook/route.ts
  - .env.example
autonomous: true
requirements:
  - EXP-01
  - EXP-02
  - SMS-01
  - SMS-02
  - SMS-03
  - SMS-04
user_setup:
  - service: pingram
    why: "Inbound SMS_INBOUND webhook + dedicated CA number for charge-capture drafts"
    env_vars:
      - name: PINGRAM_WEBHOOK_SECRET
        source: "Pingram Dashboard -> Webhook -> secret (pingram_whsecret_...)"
      - name: PINGRAM_INBOUND_NUMBER
        source: "Pingram Dashboard -> SMS number in E.164 (the shared Canary inbox number)"
    dashboard_config:
      - task: "Set Events Webhook URL to https://<host>/api/pingram/webhook and enable SMS_INBOUND (also SMS_UNSUBSCRIBE is fine to ignore)"
        location: "Pingram Dashboard -> Webhook (region ca)"
      - task: "Allow notification type sms_charge_capture for outbound draft/confirm SMS (same pattern as vendor_job_assignment)"
        location: "Pingram Dashboard -> Notification types"
      - task: "Apply migration 0057 locally (supabase db push / migration up) before testing SMS posting"
        location: "Local Supabase"
      - task: "Ensure each staff person who will text has people.phone set (manager/employee/admin, active)"
        location: "Canary People UI"
must_haves:
  truths:
    - "Staff recording an expense enter supplies cost and labour hours; the saved row stores snapshotted markup 30%, labour $50/hr, 15% HST, owner subtotal, and owner total"
    - "Owner statements and disbursement detail show date/category label, subtotal before HST, and total after HST — never supplies cost, markup, labour, notes, photos, or original SMS"
    - "An inbound SMS from a known staff phone drafts a bill-back and texts the breakdown; Y posts it; N cancels; inferred amounts never post without Y"
    - "Unknown numbers produce no reply and no expense"
    - "Ambiguous property nicknames get an SMS asking Reply 1 or 2"
    - "MMS receipt images attach as staff-only files on the posted expense"
    - "A later shorthand that matches a confirmed phrase fills the draft from typical hours/supplies and still requires Y"
  artifacts:
    - path: "supabase/migrations/0057_expense_billing_and_sms_capture.sql"
      provides: "Expense breakdown columns, org rate defaults, drafts, phrases, receipts, webhook idempotency, staff-only RLS"
      contains: "supplies_cost"
    - path: "src/lib/billing/expense-breakdown.ts"
      provides: "Locked billing formula with cent rounding"
      exports: ["computeExpenseBilling", "DEFAULT_EXPENSE_RATES"]
    - path: "src/app/api/pingram/webhook/route.ts"
      provides: "Pingram SMS_INBOUND handler with signature verification"
    - path: "src/lib/sms/charge-capture.ts"
      provides: "Staff identity, draft, Y/N post, learning hook"
      exports: ["handleInboundSms"]
    - path: "src/components/payments/StatementPDF.tsx"
      provides: "Owner PDF columns for subtotal and total"
  key_links:
    - from: "src/lib/billing/expense-breakdown.ts"
      to: "expenses insert"
      via: "computeExpenseBilling before every manual/SMS expense write"
      pattern: "computeExpenseBilling"
    - from: "src/app/api/pingram/webhook/route.ts"
      to: "pingram/webhooks verify"
      via: "raw body + X-Pingram-* headers"
      pattern: "from 'pingram/webhooks'"
    - from: "src/lib/sms/charge-capture.ts"
      to: "sms_charge_drafts then expenses"
      via: "Y posts only from pending_confirm draft"
      pattern: "pending_confirm"
    - from: "src/components/payments/StatementPDF.tsx"
      to: "subtotal + billedAmount"
      via: "owner-visible columns"
      pattern: "subtotal"
---

<objective>
Implement SMS charge capture end-to-end: persist the real Canary expense formula (supplies × 1.30 + hours × $50, then 15% HST, rates snapshotted), keep cost/markup/labour/notes/photos/SMS staff-only, then accept Pingram inbound texts from known staff phones, draft with Y/N confirm, store MMS receipts privately, and learn shorthand from confirmed notes.

Purpose: Field staff can bill an owner from a text without opening the app, without auto-posting a wrong amount, and without leaking internal cost into owner statements.

Output: Migration 0057 + billing helper, updated record-expense and Canary debit writes, owner statement/disbursement subtotal+total, Pingram webhook inbox, draft/confirm SMS, private receipts, phrase learning, staff ledger showing who posted and original text.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/notes/2026-08-24-sms-charge-capture-design.md
@.planning/todos/pending/2026-08-24-expense-billing-breakdown.md
@supabase/migrations/0017_create_expenses.sql
@src/app/actions/canary.ts
@src/app/(manager)/payments/actions.ts
@src/components/payments/RecordExpenseDialog.tsx
@src/lib/work-orders/sms.ts
@src/lib/billing/period-summary.ts
@src/app/api/stripe/webhook/route.ts
@src/app/api/meta/webhook/route.ts
@src/lib/ai/gateway.ts
@src/lib/addresses/short-property-address.ts
@src/lib/supabase/admin.ts

## Locked decisions (honor exactly — do not reopen)
- D-01: One shared Pingram number. Staff identity from inbound `from` → `people.phone` (manager/employee/admin, active). Unknown numbers: ignore, no reply.
- D-02: Always SMS a draft; post only on Y; N cancels. Never auto-post inferred amounts.
- D-03: Owner-visible: subtotal before HST and total after HST (plus category/label). Staff-only: supplies cost, markup, labour, photos, notes, original SMS, who posted.
- D-04: Formula (org defaults, snapshotted on each expense): supplies_marked_up = round(supplies_cost × 1.30, 2); labour = round(hours × 50, 2); subtotal = supplies_marked_up + labour; hst = round(subtotal × 0.15, 2); total = subtotal + hst.
- D-05: Date = today (America/St_Johns). Property from fuzzy address ("73 Casey"). Ambiguous: SMS back Reply 1 or 2.
- D-06: After each Y, store normalized job phrase → category / typical hours / typical supplies. Later shorthand fills the draft, still requires Y.
- D-07: D-11 remains: owners/tenants never SELECT cost/markup/labour/notes. Keep `vendor_cost` (sync to supplies_cost) so existing privacy comments stay true.
- D-08: This flow is owner ledger bill-back only. Do not create tenant charges from SMS.
- D-09: "$100" in shorthand like "Charge 73 Casey $100" is two hours of labour at $50/hr, not a round owner total.

## Pingram inbound caveat (do not block implementation)
Pingram docs emphasize reply matching within 7 days of last outbound. Y/N is a reply to the draft SMS, so the confirm window is fine. Implement `/api/pingram/webhook` for `SMS_INBOUND` with `from` / `to` / `text` / optional `media` on the dedicated number. If unsolicited first messages never arrive in production, that is an ops follow-up (dedicated inbox / keep-alive), not a reason to skip the webhook.

## Next.js (this repo is 16.2.9)
Do not invent Pages Router APIs. Match existing App Router webhooks:
- `src/app/api/stripe/webhook/route.ts`: `export const runtime = 'nodejs'`, `POST(req: Request)`, `await req.text()` before any JSON parse, `createAdminClient()`.
- `src/app/api/meta/webhook/route.ts`: `NextRequest` / `NextResponse` from `next/server`.
Pingram official snippet uses `NextRequest` + `verify` from `pingram/webhooks`. Use that. Node runtime required (HMAC + Pingram SDK). No Edge.

## Existing patterns
- Expenses RLS today: managers/admins only; no owner/tenant SELECT (0017). Keep that. Do not add owner/tenant policies on expenses, drafts, phrases, or receipts.
- `savePaymentEntry` debit currently writes the same number to `vendor_cost` and `billed_amount` — that is the bug this plan replaces for manual/SMS bill-backs.
- Work-order completion expenses (`src/app/actions/work-orders.ts`) currently copy invoice → billed_amount with no markup/HST. Do not apply D-04 to those rows. Fill new NOT NULL columns as a passthrough snapshot (markup/labour/hst = 0, subtotal = billed_amount, source_channel = work_order).
- Owner PDF/disbursement already omit `vendor_cost`. Extend them with `subtotal` (before HST) plus existing `billed_amount` (after HST).
- Canary payments ledger is the staff UI (`/app?view=payments`). RecordExpenseDialog is the older manager dialog — update both write paths.
- Phone helper `toE164` in `src/lib/work-orders/sms.ts` is currently private — extract to `src/lib/sms/e164.ts` and reuse.
- Storage: private `org-assets` bucket; staff SELECT; owners have no general object SELECT. Put receipts at `{org_id}/expense-receipts/{id}/{filename}` in `org-assets` (no new bucket).
- Vitest: `src/lib/businessDays.test.ts` style (`describe`/`it`/`expect`, `npx vitest run <files>`).
- Types: update `src/types/supabase.ts` by hand (no codegen script).

## Interfaces / contracts

src/lib/billing/expense-breakdown.ts:
- DEFAULT_EXPENSE_RATES = { markupRate: 0.30, labourRate: 50, hstRate: 0.15 }
- OrgRates = those three numbers, loaded from organizations columns (same names)
- computeExpenseBilling({ suppliesCost, labourHours, rates }):
  - suppliesMarkedUp = round2(suppliesCost * (1 + rates.markupRate))  // 1.30 when markupRate is 0.30
  - labourAmount = round2(labourHours * rates.labourRate)
  - subtotal = suppliesMarkedUp + labourAmount
  - hstAmount = round2(subtotal * rates.hstRate)
  - total = subtotal + hstAmount
  - markupAmount = suppliesMarkedUp - round2(suppliesCost)
  - round2 = Math.round(n * 100) / 100
- Example locked in design: supplies 48.62, hours 2 → marked-up 63.21, labour 100.00, subtotal 163.21, HST 24.48, total 187.69

src/lib/sms/charge-capture.ts:
- handleInboundSms(input: { from: string; to: string; text: string; media?: { url: string; contentType?: string }[]; pingramId: string }): Promise<void>
- Never throws to the webhook caller for business skips (unknown number, empty text). Log and return.

Pingram SMS_INBOUND JSON (verified body): eventType, from, to, text, receivedAt, optional media[], optional lastTrackingId / userId / isReply.

Outbound draft SMS shape (plain text, keep under typical SMS length; truncate note if needed):
Draft bill-back for {short address}
{category}{optional note}
Supplies ${cost} × 1.30 = ${markedUp}
Labour {hours}h × ${rate} = ${labour}
Subtotal ${subtotal}
HST 15% ${hst}
Total ${total}
Reply Y to post, N to cancel
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Expense billing breakdown, org defaults, staff writes, owner-visible subtotal+total</name>
  <files>supabase/migrations/0057_expense_billing_and_sms_capture.sql, src/lib/billing/expense-breakdown.ts, src/lib/billing/expense-breakdown.test.ts, src/types/supabase.ts, src/app/(manager)/payments/actions.ts, src/components/payments/RecordExpenseDialog.tsx, src/app/actions/canary.ts, src/app/actions/work-orders.ts, src/lib/canary/types.ts, src/components/canary/CanaryApp.tsx, src/lib/billing/period-summary.ts, src/app/(manager)/payments/disbursement/actions.ts, src/app/(manager)/payments/disbursement/[propertyId]/page.tsx, src/components/payments/StatementPDF.tsx, src/app/api/statements/generate/route.ts, src/app/api/statements/export/route.ts</files>
  <behavior>
    - computeExpenseBilling({ suppliesCost: 48.62, labourHours: 2, rates: DEFAULT_EXPENSE_RATES }) → suppliesMarkedUp 63.21, labourAmount 100, subtotal 163.21, hstAmount 24.48, total 187.69, markupAmount 14.59
    - computeExpenseBilling({ suppliesCost: 0, labourHours: 2, rates: DEFAULT }) → labour 100, subtotal 100, hst 15, total 115
    - computeExpenseBilling({ suppliesCost: 10, labourHours: 0, rates: DEFAULT }) → marked-up 13, subtotal 13, hst 1.95, total 14.95
    - round2 uses cent rounding (e.g. 1.005 → 1.01)
  </behavior>
  <action>
    Per EXP-01, EXP-02, D-03, D-04, D-07.

    1. Write failing Vitest for computeExpenseBilling covering the behaviors above, then implement src/lib/billing/expense-breakdown.ts until green.

    2. Add supabase/migrations/0057_expense_billing_and_sms_capture.sql (next number after 0056; do not reuse 0056). Include ALL schema this plan needs so later tasks do not add migrations:
    - organizations: expense_markup_rate numeric(5,4) NOT NULL DEFAULT 0.30; expense_labour_rate numeric(10,2) NOT NULL DEFAULT 50; expense_hst_rate numeric(5,4) NOT NULL DEFAULT 0.15. CHECKs: rates >= 0.
    - expenses new columns (all NOT NULL except notes/sms text): supplies_cost numeric(10,2) DEFAULT 0 CHECK >= 0; markup_rate numeric(5,4) DEFAULT 0.30; markup_amount numeric(10,2) DEFAULT 0; labour_hours numeric(8,2) DEFAULT 0 CHECK >= 0; labour_rate numeric(10,2) DEFAULT 50; labour_amount numeric(10,2) DEFAULT 0; subtotal numeric(10,2) DEFAULT 0; hst_rate numeric(5,4) DEFAULT 0.15; hst_amount numeric(10,2) DEFAULT 0; staff_notes text NULL; source_channel text NOT NULL DEFAULT 'manual' CHECK IN ('manual','sms','work_order'); source_sms_text text NULL. Keep vendor_cost and billed_amount.
    - Backfill existing expenses: supplies_cost = vendor_cost; subtotal = billed_amount; hst_amount = 0; labour_* = 0; markup_amount = 0; source_channel = 'manual'.
    - sms_charge_drafts: id uuid PK, org_id, person_id FK people, from_phone text, status CHECK IN ('pending_property','pending_confirm','posted','cancelled'), original_text text NOT NULL, property_id uuid NULL FK properties, candidate_properties jsonb NOT NULL DEFAULT '[]', category text, note text, supplies_cost numeric, labour_hours numeric, computed jsonb, pingram_message_id text, created_at timestamptz DEFAULT now(), expires_at timestamptz NOT NULL. Partial unique index on (org_id, from_phone) WHERE status IN ('pending_property','pending_confirm').
    - sms_charge_phrases: id uuid PK, org_id, normalized_phrase text NOT NULL, category text, typical_hours numeric(8,2), typical_supplies_cost numeric(10,2), hit_count int NOT NULL DEFAULT 1, last_confirmed_at timestamptz, UNIQUE (org_id, normalized_phrase).
    - expense_receipts: id uuid PK, org_id, expense_id uuid NULL FK expenses ON DELETE CASCADE, draft_id uuid NULL FK sms_charge_drafts ON DELETE SET NULL, storage_path text NOT NULL, content_type text, created_at timestamptz DEFAULT now().
    - pingram_webhook_events: pingram_id text PRIMARY KEY, event_type text, received_at timestamptz DEFAULT now().
    - RLS: ENABLE on all new tables. Policies: manager/admin FOR ALL using org_id = public.org_id() and user_role IN ('manager','admin') — same spirit as 0017 expenses. No owner/tenant SELECT. Service role (webhook) bypasses RLS via createAdminClient.
    - Do not add storage policies that let owners read org-assets/expense-receipts.

    3. Update src/types/supabase.ts Row/Insert/Update for organizations, expenses, and the three new tables (plus Relationships).

    4. recordExpense (payments/actions.ts) + RecordExpenseDialog: accept property_id, description, supplies_cost, labour_hours, expense_date (optional staff_notes). Load org rates from organizations for the caller's org. Run computeExpenseBilling. Insert supplies_cost, vendor_cost = supplies_cost, snapshotted rates/amounts, subtotal, hst_amount, billed_amount = total, source_channel = 'manual', created_by. Dialog shows supplies + hours inputs and a read-only preview of marked-up supplies, labour, subtotal, HST, total. Do not let the user type billed_amount.

    5. savePaymentEntry debit path: extend input with suppliesCost and labourHours (numbers >= 0). For Debit, require at least one of supplies or hours > 0. Ignore the old single amount as the billed total. Compute via org rates, same insert shape as recordExpense, description still category + optional note. Credit path unchanged. Update CanaryApp payment modal (PayFormState around the Record expense dialog ~line 239 and ~4450): when type is Debit, show Supplies $ and Hours instead of Amount $; live-preview subtotal/HST/total using DEFAULT_EXPENSE_RATES on the client (preview only — server recomputes). Do not rewrite unrelated CanaryApp views.

    6. work-orders.ts expense inserts on completion: do not apply D-04. Set supplies_cost = vendorCost, vendor_cost = vendorCost, billed_amount unchanged, markup_rate/amount 0, labour 0, subtotal = billed_amount, hst 0, source_channel = 'work_order'.

    7. Owner-facing (D-03, EXP-02): PeriodExpense, DisbursementExpense, StatementData expenses include description, subtotal, billedAmount (total after HST). SELECT from expenses only id, description, billed_amount, subtotal, expense_date — never vendor_cost, supplies_cost, markup_*, labour_*, staff_notes, source_sms_text. StatementPDF table: Description, Subtotal (before HST), Total (after HST). Disbursement expense table same two amount columns. statements/generate and statements/export pass subtotal through. Period totals still sum billed_amount (owner total). Add a one-line security comment that subtotal is owner-visible by design and cost/markup/labour remain excluded.
  </action>
  <verify>
    <automated>npx vitest run src/lib/billing/expense-breakdown.test.ts; npx --yes rg -n "computeExpenseBilling|supplies_cost|subtotal" src/app/actions/canary.ts src/app/(manager)/payments/actions.ts src/components/payments/StatementPDF.tsx src/lib/billing/period-summary.ts; npx --yes rg -n "supplies_cost|markup_amount|labour_hours|staff_notes|source_sms" src/components/payments/StatementPDF.tsx src/app/(manager)/payments/disbursement/actions.ts src/app/(owner-nologin) src/app/(tenant) || true</automated>
  </verify>
  <done>Migration 0057 exists with breakdown columns, org defaults, drafts/phrases/receipts/webhook events, and no owner SELECT policies. computeExpenseBilling matches the locked 48.62/2h example. Manual expense and Canary debit writes snapshot the formula. Work-order expenses stay passthrough. Owner PDF/disbursement/period-summary select and render subtotal + billed total only.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Pingram inbound webhook, staff identity, parse, draft SMS, Y/N confirm</name>
  <files>src/lib/sms/e164.ts, src/lib/sms/pingram-send.ts, src/lib/sms/match-property.ts, src/lib/sms/match-property.test.ts, src/lib/sms/parse-charge-note.ts, src/lib/sms/parse-charge-note.test.ts, src/lib/sms/charge-capture.ts, src/lib/sms/charge-capture.test.ts, src/lib/work-orders/sms.ts, src/app/api/pingram/webhook/route.ts, .env.example</files>
  <behavior>
    - toE164('709-555-0100') → '+17095550100'; toE164('+17095550100') unchanged; phonesEqual ignores formatting
    - matchProperties('73 Casey', [{id:'a', street_address:'73 Casey Street, St. John\'s'}, {id:'b', street_address:'10 Duckworth St'}]) → single id a
    - matchProperties('Casey', two Casey streets) → two candidates (ambiguous)
    - parseChargeNote('$48.62 in supplies billed to 73 Casey Street plus 2 hours of time') → suppliesCost 48.62, labourHours 2, addressHint includes 73 Casey
    - parseChargeNote('Charge 73 Casey $100') → suppliesCost 0, labourHours 2 (D-09: $100 is labour at $50/hr, not owner total)
    - parseChargeNote('Y') and parseChargeNote('n') classified as confirm/cancel, not a new charge
    - handleInboundSms unknown from → no sendSms, no insert expenses
    - handleInboundSms known staff + unique property → send draft SMS containing Subtotal and Total and Y; expenses row count unchanged until Y
    - handleInboundSms Y with pending_confirm draft → one expenses insert with source_channel sms, created_by = staff person, billed_amount = computed total; never posts on the first message
  </behavior>
  <action>
    Per SMS-01, SMS-02, D-01, D-02, D-05, D-09.

    1. Extract toE164 + phonesEqual (last-10-digit and E.164 compare) into src/lib/sms/e164.ts. Update work-orders/sms.ts to import toE164. Add sendChargeCaptureSms({ to, message }) in src/lib/sms/pingram-send.ts: Pingram region 'ca', type 'sms_charge_capture', same non-throwing log style as sendVendorJobSMS, skip if PINGRAM_API_KEY missing.

    2. match-property.ts: given org properties (id + street_address), fuzzy match the note. Require a street number when present in the hint ('73') plus a case-insensitive token of length >= 4 from the street name ('casey'), or unique street-number match. Zero hits → empty. Two-plus → all candidates (cap 5). Use shortPropertyAddress only for SMS labels, not as the matcher. Tests as listed.

    3. parse-charge-note.ts heuristics (must work without AI):
    - Confirm tokens: trimmed message matching /^(y|yes)$/i → confirm; /^(n|no|cancel)$/i → cancel; /^[1-5]$/ → propertyChoice.
    - Ignore STOP/HELP/START (return kind 'ignore') so Pingram opt-out is not parsed as a job.
    - Supplies: /\$?([0-9]+(?:\.[0-9]{1,2})?)\s*(?:in\s+)?supplies/i or 'supplies $X' / 'parts $X' / 'receipt $X'.
    - Hours: /([0-9]+(?:\.[0-9]+)?)\s*(hours?|hrs?)/i.
    - Bare money with no supplies keyword: labourHours = amount / labourRate (default 50), per D-09. If both supplies and bare money appear, do not treat the supplies figure as labour.
    - Address hint: leftover text after stripping money/hour words; keep number+name fragments.
    - Category: if a PAY_CATEGORIES token appears (Maintenance, Supplies, Cleaning, Utilities, Other) use it; else default 'Maintenance'.
    - Optional: if heuristics leave supplies=0 AND hours=0 AND gatewayGenerateText is configured, call it with tag sms-charge-parse asking for JSON { suppliesCost, labourHours, addressHint, category, note } and merge. Heuristics remain the source of truth for D-09 when a bare $ amount exists.
    - Phrase overlay: caller may pass learned { typicalHours, typicalSuppliesCost, category }; if the note has no explicit hours/supplies, fill from the phrase. Still never post.

    4. charge-capture.ts handleInboundSms using createAdminClient:
    - Idempotency: insert pingram_webhook_events (pingram_id). On unique violation, return.
    - Resolve staff: normalize from; load people where active=true and role overlaps manager/employee/admin; match phone via phonesEqual. If PINGRAM_INBOUND_NUMBER is set and `to` does not match it, still identify staff but prefer people in the org that owns that number; if number unset, first matching staff wins. Unknown → return, do not SMS.
    - Load org rates from that person's organizations row.
    - If an open draft exists for org+from_phone:
      - confirm (Y): if status pending_confirm and property_id set, insert expense with computeExpenseBilling, vendor_cost=supplies_cost, billed_amount=total, source_channel='sms', source_sms_text=original_text (the charge note, not 'Y'), created_by=person_id, expense_date=today America/St_Johns, staff_notes=note. Mark draft posted. SMS 'Posted: {short address} total ${total}'. If pending_property, SMS 'Pick a property first (reply 1 or 2).'
      - cancel (N): mark cancelled, SMS 'Cancelled.'
      - propertyChoice: set property_id from candidate_properties[n-1], status pending_confirm, send the full draft breakdown SMS (D-02).
      - else: treat as a new charge (replace the open draft).
    - New charge: parse + match properties. 0 properties → SMS 'No property matched. Include a street number, e.g. 73 Casey.' and store/cancel no post. 2+ → status pending_property, store candidates numbered, SMS 'Reply 1 or 2:\n1) {short}\n2) {short}'. 1 match → pending_confirm, send draft breakdown per D-02. Date always today America/St_Johns. Never insert expenses except on Y.

    5. src/app/api/pingram/webhook/route.ts: runtime nodejs. POST only. Read raw body with req.text() FIRST. verify({ payload, headers: { id: x-pingram-id, signature: x-pingram-signature, timestamp: x-pingram-timestamp }, secret: PINGRAM_WEBHOOK_SECRET }) from 'pingram/webhooks'. WebhookSignatureError / WebhookTimestampError → 401. Missing secret → 500. Parse verified event. If eventType !== 'SMS_INBOUND', return 200 { received: true } without charge logic. Else call handleInboundSms with from, to, text, media, pingramId from X-Pingram-Id. Always 200 after a verified event so Pingram does not retry a successful Y into a duplicate post (idempotency table is the backstop). Catch handler errors, log, still 200 after verify (or 500 only if you have not yet recorded pingram_id — prefer recording id first).

    6. .env.example: PINGRAM_WEBHOOK_SECRET and PINGRAM_INBOUND_NUMBER comments (server-only, never NEXT_PUBLIC).

    7. Tests: mock supabase and sendChargeCaptureSms. Cover unknown number, unique-property draft without insert, Y posts once, second Y with posted draft does not duplicate, D-09 $100 labour, ambiguous Reply 1 path if tested at unit level.

    Note in SUMMARY (not in code comments as a TODO): unsolicited inbound may depend on Pingram dedicated-number inbox; Y as a reply is inside the 7-day window.
  </action>
  <verify>
    <automated>npx vitest run src/lib/billing/expense-breakdown.test.ts src/lib/sms/match-property.test.ts src/lib/sms/parse-charge-note.test.ts src/lib/sms/charge-capture.test.ts; npx --yes rg -n "from 'pingram/webhooks'|handleInboundSms|SMS_INBOUND" src/app/api/pingram/webhook/route.ts</automated>
  </verify>
  <done>Webhook verifies Pingram signatures, ignores unknown numbers, texts a draft for known staff, posts only on Y, cancels on N, and asks Reply 1 or 2 when the property is ambiguous. Vitest covers D-09 labour dollars and the no-auto-post path.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: MMS receipts to private storage, phrase learning, staff UI for poster and original SMS</name>
  <files>src/lib/sms/learn-phrase.ts, src/lib/sms/learn-phrase.test.ts, src/lib/sms/charge-capture.ts, src/lib/canary/load-db.ts, src/lib/canary/types.ts, src/components/canary/CanaryApp.tsx</files>
  <behavior>
    - normalizeJobPhrase('Airbnb Restock 73 Casey Street plus 2 hours') → 'airbnb restock' (address, money, hour phrases stripped; lowercase; collapsed whitespace)
    - normalizeJobPhrase('Charge 73 Casey $100') → empty or too-generic → do not learn (function returns null)
    - After Y, upsert sms_charge_phrases on (org_id, normalized_phrase) with category, typical_hours, typical_supplies_cost, hit_count increment
    - parseChargeNote('Airbnb Restock 73 Casey', { phrases: [{ normalized_phrase: 'airbnb restock', typical_hours: 1, typical_supplies_cost: 40, category: 'Supplies' }] }) fills hours 1 and supplies 40 when the text has no explicit amounts; still not a post
  </behavior>
  <action>
    Per SMS-03, SMS-04, D-03, D-06.

    1. learn-phrase.ts: normalizeJobPhrase strips street numbers + following name tokens that matched a property, currency amounts, hour/hr phrases, leading verbs charge/bill/posted, punctuation. If remaining token count &lt; 2 or length &lt; 6, return null (do not learn generic 'charge'). upsertPhrase after successful Y.

    2. Wire learning inside handleInboundSms only after the expense insert succeeds (D-06). Later inbound notes: before heuristics amounts, look up phrases for the org where normalized_phrase is a substring of the normalized incoming text (prefer longest phrase). Overlay typical hours/supplies/category when the new text did not specify them. Draft SMS still goes out; Y still required.

    3. MMS (SMS-03): when media[] is present on the inbound that creates or updates a draft, fetch each url (timeout ~10s), allow content types image/jpeg, image/png, image/gif, image/webp, application/pdf, skip others and skip bodies over 1.5MB. Upload via createAdminClient storage to org-assets at `{org_id}/expense-receipts/{draft_id}/{uuid}.{ext}`. Insert expense_receipts with draft_id. On Y, update those rows' expense_id. Never put storage_path or signed URLs into owner statements, period-summary SELECTs, or StatementPDF.

    4. Staff UI (D-03): Canary is manager-only. Extend CanaryPayment with postedBy (string | null), sourceSms (string | null), sourceChannel ('manual' | 'sms' | 'work_order' | null), receiptCount (number). load-db expenses select: add created_by, source_sms_text, source_channel, supplies_cost, labour_hours, subtotal, hst_amount, billed_amount, and people!created_by(first_name,last_name) plus a count of expense_receipts if cheap (separate query keyed by expense id is fine). Map postedBy from the person name; sourceSms from source_sms_text. Payments table/card: for Debit rows, append sub line like 'Posted by {name}' and if sourceSms, show the original text (truncate ~120 chars). Do not show supplies/markup/labour on owner surfaces (Canary is staff). If receiptCount > 0, show 'Receipt (n)' on the staff card sub. Persist storage_path; do not add an owner-facing viewer.

    5. Keep D-11: grep owner/tenant/StatementPDF/period-summary/disbursement SELECTs must still omit supplies_cost, vendor_cost, markup_*, labour_*, staff_notes, source_sms_text, storage_path.
  </action>
  <verify>
    <automated>npx vitest run src/lib/billing/expense-breakdown.test.ts src/lib/sms/match-property.test.ts src/lib/sms/parse-charge-note.test.ts src/lib/sms/charge-capture.test.ts src/lib/sms/learn-phrase.test.ts; npx --yes rg -n "source_sms_text|postedBy|expense-receipts|normalizeJobPhrase" src/lib/canary/load-db.ts src/lib/sms/charge-capture.ts src/lib/sms/learn-phrase.ts; npx --yes rg -n "supplies_cost|source_sms_text|staff_notes" src/components/payments/StatementPDF.tsx src/app/(manager)/payments/disbursement/actions.ts src/lib/billing/period-summary.ts</automated>
  </verify>
  <done>Confirmed Y upserts a learnable phrase and later shorthand fills draft amounts but still waits for Y. MMS files land in org-assets/expense-receipts and attach to the expense, never to owner PDFs. Canary debit rows show who posted and the original SMS for SMS-sourced expenses.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Pingram → /api/pingram/webhook | Unauthenticated HTTP; only verified signatures may run charge logic |
| Inbound SMS text → parser/DB | Untrusted natural language from a phone; must not auto-post or run as SQL |
| Staff write → expenses | Authenticated manager/admin session inserts breakdown rows |
| Owner statement/PDF → owner | Must not include cost, markup, labour, notes, SMS, receipts |
| Storage org-assets/expense-receipts | Staff-only; service role uploads from webhook |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-260824-01 | Spoofing | /api/pingram/webhook | mitigate | verify() from pingram/webhooks on raw body + X-Pingram-Id/Signature/Timestamp; reject WebhookSignatureError/WebhookTimestampError with 401; require PINGRAM_WEBHOOK_SECRET |
| T-260824-02 | Spoofing | staff identity | mitigate | Map from→people.phone only for active manager/employee/admin; unknown numbers ignored with no reply (D-01) |
| T-260824-03 | Tampering | expense amounts | mitigate | Server computeExpenseBilling from supplies+hours and snapshotted org rates; never trust client billed_amount; never post on inferred parse without Y (D-02) |
| T-260824-04 | Information Disclosure | owner statements | mitigate | No owner/tenant RLS on expenses/drafts/phrases/receipts; owner SELECTs only description, subtotal, billed_amount, expense_date; StatementPDF must not reference supplies_cost/markup/labour/notes/SMS/receipts (D-03, D-07) |
| T-260824-05 | Information Disclosure | MMS receipts | mitigate | Store under org-assets/{org_id}/expense-receipts/; existing staff-only storage SELECT; do not generate owner-facing signed URLs |
| T-260824-06 | Elevation | webhook DB | mitigate | createAdminClient only after signature verify; idempotent pingram_webhook_events PK prevents replay of a processed Y |
| T-260824-07 | Denial of Service | media fetch | mitigate | Timeout, MIME allowlist, 1.5MB cap, skip failures; webhook still 200 |
| T-260824-08 | Repudiation | posted expense | mitigate | created_by = matched staff person; persist source_sms_text and source_channel=sms |
| T-260824-SC | Tampering | npm installs | accept | No new packages; pingram and ai already in package.json |
</threat_model>

<verification>
1. npx vitest run on all new test files listed in task verifies.
2. Owner grep: StatementPDF, disbursement/actions, period-summary, owner-nologin, tenant routes do not SELECT or render supplies_cost, markup_amount, labour_hours, staff_notes, source_sms_text.
3. After migration: Record Expense / Canary debit with supplies 48.62 and 2 hours stores billed_amount 187.69 and subtotal 163.21.
4. Simulated webhook (or unit tests with mocks): unknown phone no SMS; known phone gets draft; Y inserts one expense; N does not.
5. Canary payments card for that expense shows poster name and original SMS.
</verification>

<success_criteria>
- EXP-01: expenses store snapshotted supplies, markup, labour, subtotal, HST, total from org defaults 30% / $50 / 15%
- EXP-02: owners see subtotal + total only
- SMS-01: shared number; staff from people.phone; unknown ignored
- SMS-02: draft SMS; Y posts; N cancels; fuzzy property; Reply 1 or 2; date today
- SMS-03: MMS in private org-assets expense-receipts, staff-only
- SMS-04: confirmed notes upsert phrases; later shorthand fills draft; still requires Y
- Work-order expense rows do not silently gain 30% markup + HST
</success_criteria>

<output>
Create `.planning/quick/260824-jzb-implement-sms-charge-capture-expense-bil/260824-jzb-SUMMARY.md` when execution completes.
Do not update ROADMAP.md (quick task).
</output>
