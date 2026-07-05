-- Migration: 20260624000000_create_checklists
-- Purpose: Create checklists and checklist_items tables for Phase 6 tenant acknowledgment flow

-- Enum
CREATE TYPE checklist_type AS ENUM ('move_in', 'move_out');

-- checklists table
CREATE TABLE checklists (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID          NOT NULL REFERENCES organizations(id),
  lease_id     UUID          NOT NULL REFERENCES leases(id),
  type         checklist_type NOT NULL,
  title        TEXT          NOT NULL,
  created_by   UUID          NOT NULL REFERENCES people(id),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  submitted_by UUID          REFERENCES people(id)
);

CREATE INDEX idx_checklists_org_lease ON checklists (org_id, lease_id);
CREATE INDEX idx_checklists_lease_id  ON checklists (lease_id);

-- checklist_items table
CREATE TABLE checklist_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID        NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  position     INTEGER     NOT NULL DEFAULT 0,
  label        TEXT        NOT NULL,
  checked      BOOLEAN     NOT NULL DEFAULT false,
  note         TEXT,
  checked_at   TIMESTAMPTZ
);

CREATE INDEX idx_checklist_items_checklist_id ON checklist_items (checklist_id);

-- RLS
ALTER TABLE checklists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

-- checklists: managers full access within org
CREATE POLICY "checklists_manager_all"
ON checklists
FOR ALL
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee')
)
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee')
);

-- checklists: tenants read own (scoped to active lease)
CREATE POLICY "checklists_tenant_select"
ON checklists
FOR SELECT
TO authenticated
USING (
  lease_id IN (
    SELECT id FROM leases
    WHERE tenant_id = (SELECT public.person_id())
      AND status = 'active'
  )
);

-- checklist_items: managers full access (via parent checklist org membership)
CREATE POLICY "checklist_items_manager_all"
ON checklist_items
FOR ALL
TO authenticated
USING (
  checklist_id IN (
    SELECT id FROM checklists
    WHERE org_id = (SELECT public.org_id())
      AND (SELECT public.user_role()) IN ('manager', 'employee')
  )
)
WITH CHECK (
  checklist_id IN (
    SELECT id FROM checklists
    WHERE org_id = (SELECT public.org_id())
      AND (SELECT public.user_role()) IN ('manager', 'employee')
  )
);

-- checklist_items: tenants read own (via active lease)
CREATE POLICY "checklist_items_tenant_select"
ON checklist_items
FOR SELECT
TO authenticated
USING (
  checklist_id IN (
    SELECT c.id FROM checklists c
    JOIN leases l ON l.id = c.lease_id
    WHERE l.tenant_id = (SELECT public.person_id())
      AND l.status = 'active'
  )
);

-- checklist_items: tenants update only while checklist is not yet submitted
CREATE POLICY "checklist_items_tenant_update"
ON checklist_items
FOR UPDATE
TO authenticated
USING (
  checklist_id IN (
    SELECT c.id FROM checklists c
    JOIN leases l ON l.id = c.lease_id
    WHERE l.tenant_id = (SELECT public.person_id())
      AND l.status = 'active'
      AND c.submitted_at IS NULL
  )
)
WITH CHECK (
  checklist_id IN (
    SELECT c.id FROM checklists c
    JOIN leases l ON l.id = c.lease_id
    WHERE l.tenant_id = (SELECT public.person_id())
      AND l.status = 'active'
      AND c.submitted_at IS NULL
  )
);
