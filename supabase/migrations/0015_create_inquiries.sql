-- 0015_create_inquiries.sql
-- Creates the inquiries table with RLS policies.
-- Inquiries are submitted by anonymous visitors via public listing pages.
-- RLS pattern: (SELECT public.org_id()) / (SELECT public.user_role()) per established 0005/0008 pattern.
--
-- Trust boundary note (T-03-02): anon INSERT uses WITH CHECK (true) because org_id is
-- resolved server-side from the org slug before the insert. The Server Action enforces
-- that org_id matches the listing's org — visitors cannot supply an arbitrary org_id.

-- ============================================================
-- Inquiry enums
-- ============================================================
CREATE TYPE public.inquiry_type AS ENUM ('inquiry', 'application');
CREATE TYPE public.inquiry_status AS ENUM ('new', 'contacted', 'closed');

-- ============================================================
-- inquiries table
-- ============================================================
CREATE TABLE public.inquiries (
  id            UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID                   NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  listing_id    UUID                   NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  type          public.inquiry_type    NOT NULL DEFAULT 'inquiry',
  name          TEXT                   NOT NULL,
  email         TEXT                   NOT NULL,
  phone         TEXT,
  move_in_date  DATE,
  budget        NUMERIC(10,2),
  note          TEXT,
  status        public.inquiry_status  NOT NULL DEFAULT 'new',
  created_at    TIMESTAMPTZ            NOT NULL DEFAULT now()
);

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON public.inquiries (org_id);
CREATE INDEX ON public.inquiries (listing_id);
CREATE INDEX ON public.inquiries (status);

-- ============================================================
-- RLS policies
-- ============================================================

-- Staff (manager, employee, admin): SELECT all inquiries within their org
CREATE POLICY "inquiries_select_staff"
ON public.inquiries
FOR SELECT
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

-- Manager/admin: UPDATE inquiry status within their org
CREATE POLICY "inquiries_update_manager"
ON public.inquiries
FOR UPDATE
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
)
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

-- Anon: INSERT only — no SELECT permitted for anonymous visitors.
-- org_id integrity is enforced by the Server Action (T-03-02 mitigation).
CREATE POLICY "inquiries_insert_anon"
ON public.inquiries
FOR INSERT
TO anon
WITH CHECK (true);
