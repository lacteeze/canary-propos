-- B5: one payments row per Stripe PaymentIntent.
CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_pi_uidx
  ON public.payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
