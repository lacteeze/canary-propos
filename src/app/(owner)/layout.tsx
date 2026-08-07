// Owner portal route group — Canary portal shell + fonts
import type { ReactNode } from 'react'
import OwnerShell from '@/components/layout/OwnerShell'
import CanaryFontShell from '@/components/layout/CanaryFontShell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  let orgName = 'Canary'
  let ownerName = 'Owner'

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const admin = createAdminClient()
      const { data: person } = await admin
        .from('people')
        .select('first_name, last_name, email, organizations(name)')
        .eq('user_id', user.id)
        .eq('active', true)
        .maybeSingle()

      if (person) {
        ownerName =
          [person.first_name, person.last_name].filter(Boolean).join(' ') ||
          person.email ||
          'Owner'
        const org = person.organizations as { name: string } | { name: string }[] | null
        const name = Array.isArray(org) ? org[0]?.name : org?.name
        if (name) orgName = name
      }
    }
  } catch {
    // defaults
  }

  return (
    <CanaryFontShell>
      <OwnerShell orgName={orgName} ownerName={ownerName}>
        {children}
      </OwnerShell>
    </CanaryFontShell>
  )
}
