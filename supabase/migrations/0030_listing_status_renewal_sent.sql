-- 0030_listing_status_renewal_sent.sql
-- Adds renewal_sent to listing_status for timeline tracking of renewals sent to tenants.

ALTER TYPE public.listing_status ADD VALUE IF NOT EXISTS 'renewal_sent';
