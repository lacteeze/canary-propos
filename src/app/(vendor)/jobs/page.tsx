// Legacy /jobs vendor shell — redirect into CanaryApp Projects
import { redirect } from 'next/navigation'

export default function JobsPage() {
  redirect('/app?view=projects')
}
