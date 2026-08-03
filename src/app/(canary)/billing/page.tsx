import { redirect } from 'next/navigation'

/** Billing lives in CanaryApp — keep /billing as a stable bookmark. */
export default function BillingRedirectPage() {
  redirect('/app?view=billing')
}
