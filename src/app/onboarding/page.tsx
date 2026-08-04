import { redirect } from 'next/navigation'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { getCaller } from '@/lib/canary/load-db'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Already has a people/org membership — don't trap them in the wizard
  const caller = await getCaller()
  if (caller !== 'no-user' && caller !== 'no-person') {
    redirect('/app')
  }

  return <OnboardingWizard />
}
