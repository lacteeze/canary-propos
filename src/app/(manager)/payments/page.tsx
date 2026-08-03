import { redirect } from 'next/navigation'

/** Legacy payments table — use CanaryApp ledger. Export/disbursement routes remain. */
export default function PaymentsRedirectPage() {
  redirect('/app?view=payments')
}
