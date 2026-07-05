-- Migration: 20260624000001_create_announcements
-- Purpose: Create announcements table for Phase 6 property announcement feed

CREATE TABLE announcements (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES organizations(id),
  property_id UUID        NOT NULL REFERENCES properties(id),
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  created_by  UUID        NOT NULL REFERENCES people(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ
);

CREATE INDEX idx_announcements_org_property ON announcements (org_id, property_id);
CREATE INDEX idx_announcements_property_date ON announcements (property_id, created_at DESC);

-- RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Managers: full CRUD within org
CREATE POLICY "announcements_manager_all"
ON announcements
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

-- Tenants: read non-expired announcements for their property only
-- Property is derived from their active lease → unit → property (no direct JWT claim)
CREATE POLICY "announcements_tenant_select"
ON announcements
FOR SELECT
TO authenticated
USING (
  property_id IN (
    SELECT u.property_id
    FROM leases l
    JOIN units u ON u.id = l.unit_id
    WHERE l.tenant_id = (SELECT public.person_id())
      AND l.status = 'active'
  )
  AND (expires_at IS NULL OR expires_at > now())
);
