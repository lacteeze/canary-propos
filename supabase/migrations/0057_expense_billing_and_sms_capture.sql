-- 0057_expense_billing_and_sms_capture.sql
-- Expense billing breakdown (D-04) + SMS charge-capture tables.
-- Owners/tenants never SELECT cost, markup, labour, notes, SMS, or receipts (D-03, D-07, D-11).
-- Keep vendor_cost in sync with supplies_cost so existing privacy comments stay true.

-- ---------------------------------------------------------------------------
-- Organizations: snapshotted rate defaults (30% markup, $50/hr, 15% HST)
-- ---------------------------------------------------------------------------
ALTER TABLE organizations
  ADD COLUMN expense_markup_rate numeric(5,4) NOT NULL DEFAULT 0.30,
  ADD COLUMN expense_labour_rate numeric(10,2) NOT NULL DEFAULT 50,
  ADD COLUMN expense_hst_rate numeric(5,4) NOT NULL DEFAULT 0.15;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_expense_markup_rate_check CHECK (expense_markup_rate >= 0),
  ADD CONSTRAINT organizations_expense_labour_rate_check CHECK (expense_labour_rate >= 0),
  ADD CONSTRAINT organizations_expense_hst_rate_check CHECK (expense_hst_rate >= 0);

-- ---------------------------------------------------------------------------
-- Expenses: breakdown columns (staff-only; owners never SELECT these)
-- ---------------------------------------------------------------------------
ALTER TABLE expenses
  ADD COLUMN supplies_cost numeric(10,2) NOT NULL DEFAULT 0 CHECK (supplies_cost >= 0),
  ADD COLUMN markup_rate numeric(5,4) NOT NULL DEFAULT 0.30,
  ADD COLUMN markup_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN labour_hours numeric(8,2) NOT NULL DEFAULT 0 CHECK (labour_hours >= 0),
  ADD COLUMN labour_rate numeric(10,2) NOT NULL DEFAULT 50,
  ADD COLUMN labour_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN subtotal numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN hst_rate numeric(5,4) NOT NULL DEFAULT 0.15,
  ADD COLUMN hst_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN staff_notes text NULL,
  ADD COLUMN source_channel text NOT NULL DEFAULT 'manual'
    CHECK (source_channel IN ('manual', 'sms', 'work_order')),
  ADD COLUMN source_sms_text text NULL;

-- Backfill existing rows: treat billed_amount as owner total (pre-HST unknown).
UPDATE expenses
SET
  supplies_cost = vendor_cost,
  subtotal = billed_amount,
  hst_amount = 0,
  labour_hours = 0,
  labour_rate = 0,
  labour_amount = 0,
  markup_amount = 0,
  markup_rate = 0,
  hst_rate = 0,
  source_channel = 'manual';

-- ---------------------------------------------------------------------------
-- SMS charge drafts (pending property choice / Y-N confirm)
-- ---------------------------------------------------------------------------
CREATE TABLE sms_charge_drafts (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id            uuid        NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  from_phone           text        NOT NULL,
  status               text        NOT NULL
    CHECK (status IN ('pending_property', 'pending_confirm', 'posted', 'cancelled')),
  original_text        text        NOT NULL,
  property_id          uuid        NULL REFERENCES properties(id) ON DELETE SET NULL,
  candidate_properties jsonb       NOT NULL DEFAULT '[]',
  category             text        NULL,
  note                 text        NULL,
  supplies_cost        numeric(10,2) NULL,
  labour_hours         numeric(8,2) NULL,
  computed             jsonb       NULL,
  pingram_message_id   text        NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  expires_at           timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE UNIQUE INDEX sms_charge_drafts_open_phone
  ON sms_charge_drafts (org_id, from_phone)
  WHERE status IN ('pending_property', 'pending_confirm');

ALTER TABLE sms_charge_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and admins manage sms_charge_drafts"
  ON sms_charge_drafts
  FOR ALL
  USING (
    org_id = (SELECT public.org_id())
    AND (SELECT public.user_role()) IN ('manager', 'admin')
  )
  WITH CHECK (
    org_id = (SELECT public.org_id())
    AND (SELECT public.user_role()) IN ('manager', 'admin')
  );

-- ---------------------------------------------------------------------------
-- Learned job phrases (typical hours/supplies after confirmed Y)
-- ---------------------------------------------------------------------------
CREATE TABLE sms_charge_phrases (
  id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  normalized_phrase      text          NOT NULL,
  category               text          NULL,
  typical_hours          numeric(8,2)  NULL,
  typical_supplies_cost  numeric(10,2) NULL,
  hit_count              int           NOT NULL DEFAULT 1,
  last_confirmed_at      timestamptz   NULL,
  UNIQUE (org_id, normalized_phrase)
);

ALTER TABLE sms_charge_phrases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and admins manage sms_charge_phrases"
  ON sms_charge_phrases
  FOR ALL
  USING (
    org_id = (SELECT public.org_id())
    AND (SELECT public.user_role()) IN ('manager', 'admin')
  )
  WITH CHECK (
    org_id = (SELECT public.org_id())
    AND (SELECT public.user_role()) IN ('manager', 'admin')
  );

-- ---------------------------------------------------------------------------
-- Staff-only MMS receipts (org-assets/{org_id}/expense-receipts/...)
-- No owner/tenant SELECT. Do not add storage policies that let owners read
-- org-assets/expense-receipts.
-- ---------------------------------------------------------------------------
CREATE TABLE expense_receipts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expense_id    uuid        NULL REFERENCES expenses(id) ON DELETE CASCADE,
  draft_id      uuid        NULL REFERENCES sms_charge_drafts(id) ON DELETE SET NULL,
  storage_path  text        NOT NULL,
  content_type  text        NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE expense_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and admins manage expense_receipts"
  ON expense_receipts
  FOR ALL
  USING (
    org_id = (SELECT public.org_id())
    AND (SELECT public.user_role()) IN ('manager', 'admin')
  )
  WITH CHECK (
    org_id = (SELECT public.org_id())
    AND (SELECT public.user_role()) IN ('manager', 'admin')
  );

-- ---------------------------------------------------------------------------
-- Pingram webhook idempotency (service_role via createAdminClient bypasses RLS)
-- No org_id — user JWTs have no SELECT (same spirit as stripe_events).
-- ---------------------------------------------------------------------------
CREATE TABLE pingram_webhook_events (
  pingram_id   text        PRIMARY KEY,
  event_type   text        NULL,
  received_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pingram_webhook_events ENABLE ROW LEVEL SECURITY;
