/**
 * Stripe webhook handler — /api/stripe/webhook
 *
 * SECURITY:
 * - Uses req.text() (raw body) — NEVER req.json().
 * - Verifies Stripe-Signature header via constructEvent before any DB writes.
 * - Inserts stripe_events first; UNIQUE(stripe_event_id) 23505 means duplicate → 200.
 */
export const runtime = 'nodejs'

import { stripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { addBusinessDays } from '@/lib/businessDays'
import type Stripe from 'stripe'

export async function POST(req: Request) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    return new Response(`Webhook signature verification failed: ${message}`, { status: 400 })
  }

  const supabase = createAdminClient()

  const { error: insertEventError } = await supabase.from('stripe_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: event as any,
  })

  if (insertEventError) {
    if (insertEventError.code === '23505') {
      return new Response('duplicate', { status: 200 })
    }
    console.error(`Failed to record Stripe event ${event.id}:`, insertEventError)
    return new Response('Failed to record event', { status: 500 })
  }

  try {
    if (
      event.type === 'payment_intent.processing' ||
      event.type === 'payment_intent.succeeded' ||
      event.type === 'payment_intent.payment_failed'
    ) {
      const pi = event.data.object as Stripe.PaymentIntent
      await upsertPaymentFromIntent(supabase, pi, event.type)
    }
  } catch (err) {
    console.error(`Error processing Stripe event ${event.id} (${event.type}):`, err)
  }

  return new Response('ok', { status: 200 })
}

async function upsertPaymentFromIntent(
  supabase: ReturnType<typeof createAdminClient>,
  pi: Stripe.PaymentIntent,
  eventType:
    | 'payment_intent.processing'
    | 'payment_intent.succeeded'
    | 'payment_intent.payment_failed',
) {
  const leaseId = pi.metadata?.lease_id
  const orgId = pi.metadata?.org_id

  if (!leaseId || !orgId) {
    console.error(`Stripe ${eventType} ${pi.id} missing lease_id/org_id metadata`)
    return
  }

  const { data: lease } = await supabase
    .from('leases')
    .select('id, org_id')
    .eq('id', leaseId)
    .maybeSingle()

  if (!lease || lease.org_id !== orgId) {
    console.error(`Stripe ${eventType} ${pi.id}: lease ${leaseId} missing or org mismatch`)
    return
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', orgId)
    .maybeSingle()

  if (!org) {
    console.error(`Stripe ${eventType} ${pi.id}: org ${orgId} missing`)
    return
  }

  const now = new Date()
  const base = {
    stripe_payment_intent_id: pi.id,
    lease_id: leaseId,
    org_id: orgId,
    amount: pi.amount / 100,
    method: 'stripe',
  }

  if (eventType === 'payment_intent.processing') {
    const { error } = await supabase.from('payments').upsert(
      {
        ...base,
        status: 'pending_clearance',
      },
      { onConflict: 'stripe_payment_intent_id', ignoreDuplicates: true },
    )
    if (error) console.error(`Stripe processing upsert failed ${pi.id}:`, error)
    return
  }

  if (eventType === 'payment_intent.succeeded') {
    const { error } = await supabase.from('payments').upsert(
      {
        ...base,
        status: 'cleared',
        cleared_at: now.toISOString(),
        disbursable_after: addBusinessDays(now, 5).toISOString(),
      },
      { onConflict: 'stripe_payment_intent_id' },
    )
    if (error) console.error(`Stripe succeeded upsert failed ${pi.id}:`, error)
    return
  }

  const { error } = await supabase.from('payments').upsert(
    {
      ...base,
      status: 'failed',
    },
    { onConflict: 'stripe_payment_intent_id' },
  )
  if (error) console.error(`Stripe failed upsert failed ${pi.id}:`, error)
}
