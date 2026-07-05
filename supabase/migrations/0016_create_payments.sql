-- 0016_create_payments.sql
-- Phase 4: Payments table — records all rent/payment transactions against a lease

CREATE TABLE payments (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lease_id                  uuid        NOT NULL REFERENCES leases(id) ON DELETE RESTRICT,
  amount                    numeric(10,2) NOT NULL CHECK (amount > 0),
  method                    text        NOT NULL CHECK (method IN ('stripe','etransfer','cheque','cash','bank_transfer')),
  status                    text        NOT NULL DEFAULT 'recorded'
                                          CHECK (status IN ('recorded','pending_clearance','cleared','failed')),
  stripe_payment_intent_id  text        NULL,
  cleared_at                timestamptz NULL,
  disbursable_after         date        NULL,
  recorded_by               uuid        NULL REFERENCES people(id),
  notes                     text        NULL,
  created_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Managers and admins have full access to payments within their org
CREATE POLICY "Managers and admins manage payments"
  ON payments
  FOR ALL
  USING (
    org_id = (SELECT org_id FROM people WHERE user_id = auth.uid() AND active = true LIMIT 1)
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND active = true
        AND (role @> ARRAY['manager'] OR role @> ARRAY['admin'])
    )
  );

-- Tenants can read their own payments (via lease membership)
CREATE POLICY "Tenants read own payments"
  ON payments
  FOR SELECT
  USING (
    lease_id IN (
      SELECT id FROM leases
      WHERE tenant_id = (
        SELECT id FROM people WHERE user_id = auth.uid() AND active = true LIMIT 1
      )
    )
  );
