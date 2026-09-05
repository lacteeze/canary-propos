/**
 * POST /api/stripe/create-payment-intent
 *
 * Creates a Stripe PaymentIntent for rent collection.
 * Amount is computed server-side from open charges (fallback: monthly rent).
 * Client-supplied amount_cents is ignored.
 */
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { paymentAmountCents } from '@/lib/billing/payment-amount'

const bodySchema = z.object({
  lease_id: z.string().uuid(),
  amount_cents: z.number().int().positive().optional(),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
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

  let body: z.infer<typeof bodySchema>
  try {
    const raw = await req.json()
    body = bodySchema.parse(raw)
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { data: lease } = await supabase
    .from('leases')
    .select('id, org_id, monthly_rent, tenant_id')
    .eq('id', body.lease_id)
    .eq('org_id', person.org_id)
    .eq('tenant_id', person.id)
    .single()

  if (!lease) {
    return Response.json({ error: 'Lease not found or access denied' }, { status: 403 })
  }

  const { data: charges } = await supabase
    .from('charges')
    .select('amount, amount_paid')
    .eq('lease_id', lease.id)
    .eq('org_id', person.org_id)
    .eq('status', 'open')

  const amountCents = paymentAmountCents({
    openCharges: charges ?? [],
    monthlyRent: lease.monthly_rent,
  })

  if (amountCents <= 0) {
    return Response.json({ error: 'Nothing is due on this lease.' }, { status: 400 })
  }

  try {
    const pi = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'cad',
      payment_method_types: ['card'],
      metadata: {
        lease_id: lease.id,
        org_id: person.org_id,
      },
    })

    return Response.json({
      clientSecret: pi.client_secret,
      amount_cents: amountCents,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create payment intent'
    console.error('Stripe PaymentIntent creation failed:', err)
    return Response.json({ error: message }, { status: 500 })
  }
}
