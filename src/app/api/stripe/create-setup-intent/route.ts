/**
 * POST /api/stripe/create-setup-intent
 *
 * Creates a Stripe SetupIntent for ACSS Debit (pre-authorized debit mandate).
 * Authenticated — requires valid user session.
 */
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(_req: Request) {
  // Get caller context
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: person } = await supabase
    .from('people')
    .select('id, org_id')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const si = await stripe.setupIntents.create({
      payment_method_types: ['acss_debit'],
      payment_method_options: {
        acss_debit: {
          mandate_options: {
            payment_schedule: 'combined',
            transaction_type: 'personal',
          },
        },
      },
    })

    return Response.json({ clientSecret: si.client_secret })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create setup intent'
    console.error('Stripe SetupIntent creation failed:', err)
    return Response.json({ error: message }, { status: 500 })
  }
}
