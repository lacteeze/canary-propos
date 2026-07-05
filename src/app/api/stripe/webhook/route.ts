/**
 * Stripe webhook handler — /api/stripe/webhook
 *
 * SECURITY:
 * - Uses req.text() (raw body) — NEVER req.json(). Re-parsing JSON breaks signature verification.
 * - Verifies Stripe-Signature header via constructEvent before any DB writes.
 * - Idempotency: checks stripe_events table BEFORE any payment insert/update.
 *   The UNIQUE constraint on stripe_events.stripe_event_id is the DB-layer backstop.
 */
export const runtime = 'nodejs'

import { stripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { addBusinessDays } from '@/lib/businessDays'
import type Stripe from 'stripe'

export async function POST(req: Request) {
  // 1. Read raw body — NEVER use req.json()
  const rawBody = await req.text()

  // 2. Get Stripe-Signature header
  const sig = req.headers.get('stripe-signature') ?? ''

  // 3. Verify signature
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    return new Response(`Webhook signature verification failed: ${message}`, { status: 400 })
  }

  // 4. Admin client — bypasses RLS, required for webhook (no user session)
  const supabase = createAdminClient()

  // 5. Idempotency check FIRST — before any DB write
  const { data: existing } = await supabase
    .from('stripe_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .maybeSingle()

  if (existing) {
    // Duplicate event — acknowledge without re-processing
    return new Response('duplicate', { status: 200 })
  }

  // 6. Process event
  try {
    switch (event.type) {
      case 'payment_intent.processing': {
        const pi = event.data.object as Stripe.PaymentIntent
        const leaseId = pi.metadata?.lease_id
        const orgId = pi.metadata?.org_id

        if (leaseId && orgId) {
          await supabase.from('payments').insert({
            stripe_payment_intent_id: pi.id,
            lease_id: leaseId,
            org_id: orgId,
            amount: pi.amount / 100,
            status: 'pending_clearance',
            method: 'stripe',
          })
        }
        break
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        const now = new Date()
        const disbursableAfter = addBusinessDays(now, 5)

        await supabase
          .from('payments')
          .update({
            status: 'cleared',
            cleared_at: now.toISOString(),
            disbursable_after: disbursableAfter.toISOString(),
          })
          .eq('stripe_payment_intent_id', pi.id)
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        await supabase
          .from('payments')
          .update({ status: 'failed' })
          .eq('stripe_payment_intent_id', pi.id)
        break
      }

      // Additional event types can be handled here in future phases
      default:
        // Unhandled event type — record it anyway for audit trail
        break
    }
  } catch (err) {
    // Log processing error but still record the event to prevent infinite retries
    console.error(`Error processing Stripe event ${event.id} (${event.type}):`, err)
  }

  // 7. Insert into stripe_events for audit trail + idempotency backstop
  await supabase.from('stripe_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: event as any,
  })

  // 8. Return 200
  return new Response('ok', { status: 200 })
}
