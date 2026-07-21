import { redirect } from 'next/navigation'

/** Legacy Version 1 inquiries list — pipeline now lives in Canary Leasing. */
export default function InquiriesRedirectPage() {
  redirect('/app')
}
