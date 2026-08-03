import { redirect } from 'next/navigation'

/** Legacy work-order list — Canary projects view. Detail/new routes remain. */
export default function MaintenanceRedirectPage() {
  redirect('/app?view=projects')
}
