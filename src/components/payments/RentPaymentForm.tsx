'use client'

/**
 * RentPaymentForm — Stripe Elements card payment form for tenant rent.
 *
 * REQUIRES (not yet in package.json — install before deploying):
 *   npm install stripe @stripe/stripe-js @stripe/react-stripe-js
 *
 * Uses Stripe Elements (PaymentElement) for PCI-compliant card input.
 * Never touches raw card data.
 */

import { useState, useEffect } from 'react'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — install `@stripe/stripe-js` and `@stripe/react-stripe-js` to resolve
import { loadStripe } from '@stripe/stripe-js'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — install `@stripe/react-stripe-js` to resolve
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

// Load Stripe outside render loop (singleton)
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface RentPaymentFormProps {
  leaseId: string
  monthlyRent: number
  propertyAddress: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount)
}

// Inner form — must be inside Elements provider
function PaymentForm({
  leaseId,
  monthlyRent,
  propertyAddress,
}: RentPaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setIsLoading(true)
    setErrorMessage(null)

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/my-home`,
      },
    })

    // Only reaches here if there was an error (successful payments redirect)
    if (error) {
      setErrorMessage(error.message ?? 'An unexpected error occurred.')
    }
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <p className="mb-1 text-sm font-medium text-stone-500">Payment amount</p>
        <p className="text-2xl font-semibold text-stone-900">{formatCurrency(monthlyRent)}</p>
        <p className="mt-1 text-sm text-stone-500">{propertyAddress}</p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <PaymentElement />
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      <p className="text-xs text-stone-500">
        ACH/bank payments are held for 5 business days before processing.
      </p>

      <button
        type="submit"
        disabled={!stripe || isLoading}
        className="w-full rounded-lg bg-stone-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? 'Processing…' : `Pay ${formatCurrency(monthlyRent)}`}
      </button>
    </form>
  )
}

// Outer wrapper — fetches clientSecret and provides Elements context
export function RentPaymentForm({ leaseId, monthlyRent, propertyAddress }: RentPaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/stripe/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lease_id: leaseId,
        amount_cents: Math.round(monthlyRent * 100),
      }),
    })
      .then((res) => res.json())
      .then((data: { clientSecret?: string; error?: string }) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret)
        } else {
          setFetchError(data.error ?? 'Could not initialize payment.')
        }
      })
      .catch(() => setFetchError('Could not connect to payment service.'))
  }, [leaseId, monthlyRent])

  if (fetchError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-sm text-red-700">{fetchError}</p>
      </div>
    )
  }

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-stone-500">Loading payment form…</p>
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm
        leaseId={leaseId}
        monthlyRent={monthlyRent}
        propertyAddress={propertyAddress}
      />
    </Elements>
  )
}
