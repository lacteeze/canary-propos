'use client'

/**
 * RentPaymentForm — Stripe Elements card payment form for tenant rent.
 */

import { useState, useEffect } from 'react'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — install `@stripe/stripe-js` and `@stripe/react-stripe-js` to resolve
import { loadStripe } from '@stripe/stripe-js'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — install `@stripe/react-stripe-js` to resolve
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface RentPaymentFormProps {
  leaseId: string
  monthlyRent: number
  propertyAddress: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount)
}

function PaymentForm({ monthlyRent, propertyAddress }: RentPaymentFormProps) {
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

    if (error) {
      setErrorMessage(error.message ?? 'An unexpected error occurred.')
    }
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
      <div className="cy-portal-card">
        <p className="cy-eyebrow" style={{ marginBottom: 6 }}>
          Payment amount
        </p>
        <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
          {formatCurrency(monthlyRent)}
        </p>
        <p className="cy-portal-muted" style={{ margin: '6px 0 0' }}>
          {propertyAddress}
        </p>
      </div>

      <div className="cy-portal-card">
        <PaymentElement />
      </div>

      {errorMessage && <div className="cy-portal-alert cy-portal-alert--err">{errorMessage}</div>}

      <p className="cy-portal-muted" style={{ margin: 0, fontSize: 12 }}>
        ACH/bank payments are held for 5 business days before processing.
      </p>

      <button
        type="submit"
        disabled={!stripe || isLoading}
        className="cy-btn-primary"
        style={{ width: '100%', padding: '10px 16px' }}
      >
        {isLoading ? 'Processing…' : `Pay ${formatCurrency(monthlyRent)}`}
      </button>
    </form>
  )
}

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
    return <div className="cy-portal-alert cy-portal-alert--err">{fetchError}</div>
  }

  if (!clientSecret) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', padding: '48px 0' }}>
        <p className="cy-portal-muted" style={{ margin: 0 }}>
          Loading payment form…
        </p>
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
