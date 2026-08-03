import { redirect } from 'next/navigation'

/** Legacy properties list — use CanaryApp. Detail routes under /properties/[id] remain. */
export default function PropertiesRedirectPage() {
  redirect('/app?view=properties')
}
