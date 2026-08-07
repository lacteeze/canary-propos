// Tenant portal route group — Canary portal shell + fonts
import type { ReactNode } from 'react'
import TenantShell from '@/components/layout/TenantShell'
import CanaryFontShell from '@/components/layout/CanaryFontShell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function TenantLayout({ children }: { children: ReactNode }) {
  let orgName = 'Canary'
  let tenantName = 'Tenant'

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const admin = createAdminClient()
      const { data: person } = await admin
        .from('people')
        .select('first_name, last_name, email, org_id, organizations(name)')
        .eq('user_id', user.id)
        .eq('active', true)
        .maybeSingle()

      if (person) {
        tenantName =
          [person.first_name, person.last_name].filter(Boolean).join(' ') ||
          person.email ||
          'Tenant'
        const org = person.organizations as { name: string } | { name: string }[] | null
        const name = Array.isArray(org) ? org[0]?.name : org?.name
        if (name) orgName = name
      }
    }
  } catch {
    // Shell still renders with defaults
  }

  return (
    <CanaryFontShell>
      <TenantShell orgName={orgName} tenantName={tenantName}>
        {children}
      </TenantShell>
    </CanaryFontShell>
  )
}
