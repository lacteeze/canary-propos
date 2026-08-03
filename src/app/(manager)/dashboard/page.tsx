import { redirect } from 'next/navigation'

/** Legacy stone dashboard — CanaryApp is the manager home. */
export default function DashboardRedirectPage() {
  redirect('/app')
}
