import { redirect } from 'next/navigation'

/** Legacy people list — use CanaryApp. */
export default function PeopleRedirectPage() {
  redirect('/app?view=people')
}
