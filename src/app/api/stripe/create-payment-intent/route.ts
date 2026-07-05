/**
 * POST /api/stripe/create-payment-intent
 *
 * Creates a Stripe PaymentIntent for rent collection.
 * Authenticated — requires valid user session.
 * Verifies lease belongs to caller's org before creating PaymentIntent.
 */
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

const bodySchema = z.object({
  lease_id: z.string().uuid(),
  amount_cents: z.number().int().positive(),
})

export async function POST(req: Request) {
  // 1. Get caller context — return 401 if no session
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: person } = await supabase
    .from('people')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse + validate request body
  let body: z.infer<typeof bodySchema>
  try {
    const raw = await req.json()
    body = bodySchema.parse(raw)
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // 3. Verify lease belongs to caller's org (prevents cross-org payment creation)
  const { data: lease } = await supabase
    .from('leases')
    .select('id, org_id, monthly_rent')
    .eq('id', body.lease_id)
    .eq('org_id', person.org_id)
    .single()

  if (!lease) {
    return Response.json({ error: 'Lease not found or access denied' }, { status: 403 })
  }

  // 4. Create Stripe PaymentIntent
  try {
    const pi = await stripe.paymentIntents.create({
      amount: body.amount_cents,
      currency: 'cad',
      payment_method_types: ['card'],
      metadata: {
        lease_id: body.lease_id,
        org_id: person.org_id,
      },
    })

    return Response.json({ clientSecret: pi.client_secret })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create payment intent'
    console.error('Stripe PaymentIntent creation failed:', err)
    return Response.json({ error: message }, { status: 500 })
  }
}
