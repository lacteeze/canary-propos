// Vendor portal route group — Canary portal shell + fonts
// Note: /jobs redirects into CanaryApp; shell remains for any residual vendor pages.
import type { ReactNode } from 'react'
import VendorShell from '@/components/layout/VendorShell'
import CanaryFontShell from '@/components/layout/CanaryFontShell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function VendorLayout({ children }: { children: ReactNode }) {
  let orgName = 'Canary'
  let vendorName = 'Vendor'

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
        vendorName =
          [person.first_name, person.last_name].filter(Boolean).join(' ') ||
          person.email ||
          'Vendor'
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
      <VendorShell orgName={orgName} vendorName={vendorName}>
        {children}
      </VendorShell>
    </CanaryFontShell>
  )
}
