-- 0019_create_owner_statements.sql
-- Phase 4: Owner statements table — monthly financial summaries per property
-- UNIQUE(property_id, period_year, period_month) prevents duplicate statement generation

CREATE TABLE owner_statements (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id     uuid          NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  period_year     int           NOT NULL,
  period_month    int           NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  pdf_path        text          NOT NULL,
  rent_collected  numeric(10,2) NOT NULL DEFAULT 0,
  total_expenses  numeric(10,2) NOT NULL DEFAULT 0,
  management_fee  numeric(10,2) NOT NULL DEFAULT 0,
  net_to_owner    numeric(10,2) NOT NULL DEFAULT 0,
  generated_at    timestamptz   NOT NULL DEFAULT now(),
  generated_by    uuid          NULL REFERENCES people(id),
  CONSTRAINT owner_statements_property_period_key UNIQUE (property_id, period_year, period_month)
);

ALTER TABLE owner_statements ENABLE ROW LEVEL SECURITY;

-- Managers and admins have full access to all statements within their org
CREATE POLICY "Managers and admins manage statements"
  ON owner_statements
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

-- Owners can read statements for their own properties
CREATE POLICY "Owners read their property statements"
  ON owner_statements
  FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties
      WHERE owner_id = (
        SELECT id FROM people WHERE user_id = auth.uid() AND active = true LIMIT 1
      )
    )
  );
