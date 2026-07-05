-- 0017_create_expenses.sql
-- Phase 4: Expenses table — tracks property expenses with vendor cost vs billed amount separation
-- IMPORTANT: vendor_cost must never be readable by owner/tenant roles (D-11 privacy constraint)

CREATE TABLE expenses (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id   uuid          NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  description   text          NOT NULL,
  vendor_cost   numeric(10,2) NOT NULL CHECK (vendor_cost >= 0),
  billed_amount numeric(10,2) NOT NULL CHECK (billed_amount >= 0),
  expense_date  date          NOT NULL,
  created_by    uuid          NULL REFERENCES people(id),
  created_at    timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Managers and admins only — no owner/tenant SELECT policy (protects vendor_cost per D-11)
CREATE POLICY "Managers and admins manage expenses"
  ON expenses
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
