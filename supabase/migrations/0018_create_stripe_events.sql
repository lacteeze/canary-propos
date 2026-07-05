-- 0018_create_stripe_events.sql
-- Phase 4: Stripe events idempotency table — prevents double-processing of webhook events
-- Written only by service_role webhook handler; UNIQUE constraint guards idempotency (T-04-02)

CREATE TABLE stripe_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id  text        NOT NULL,
  event_type       text        NOT NULL,
  processed_at     timestamptz NOT NULL DEFAULT now(),
  payload          jsonb       NOT NULL DEFAULT '{}',
  CONSTRAINT stripe_events_stripe_event_id_key UNIQUE (stripe_event_id)
);

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

-- Only service_role (webhook handler) may read/write stripe_events
CREATE POLICY "Service role only"
  ON stripe_events
  FOR ALL
  USING (auth.role() = 'service_role');
