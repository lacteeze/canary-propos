import { redirect } from 'next/navigation'

/** Legacy leases list — use CanaryApp. Detail routes under /leases/[id] remain. */
export default function LeasesRedirectPage() {
  redirect('/app?view=leases')
}
