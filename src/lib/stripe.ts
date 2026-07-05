/**
 * stripe.ts — Stripe singleton + exported secrets
 *
 * SERVER ONLY — never import in 'use client' files.
 * STRIPE_SECRET_KEY is a secret and must never be exposed to the browser.
 */
import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

function getStripeInstance(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    stripeInstance = new Stripe(key, {
      apiVersion: '2026-05-27.dahlia' as any,
      typescript: true,
    })
  }
  return stripeInstance
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const instance = getStripeInstance()
    const value = Reflect.get(instance, prop, receiver)
    return typeof value === 'function' ? value.bind(instance) : value
  },
})

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ''
