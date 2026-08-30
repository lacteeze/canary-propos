-- 0060_listing_status_declined.sql
-- Adds declined to listing_status so staff can mark a renewal as declined.

ALTER TYPE public.listing_status ADD VALUE IF NOT EXISTS 'declined';
