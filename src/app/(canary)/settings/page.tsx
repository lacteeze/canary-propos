// Org settings — Canary shell (replaces legacy ManagerShell settings UI)
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CanarySettingsShell } from '@/components/settings/CanarySettingsShell'
import { OrgSettingsForm } from '@/components/settings/OrgSettingsForm'
import { GmailIntegrationSection } from '@/components/settings/GmailIntegrationSection'

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: person } = await supabase
    .from('people')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) redirect('/login')

  const roles = (person.role as unknown as string[]) ?? []
  if (!roles.includes('manager') && !roles.includes('employee') && !roles.includes('admin')) {
    redirect('/app')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: org } = await (supabase as any)
    .from('organizations')
    .select('id, name, province, logo_path, gmail_connected_at')
    .eq('id', person.org_id)
    .single()

  if (!org) redirect('/login')

  return (
    <CanarySettingsShell>
      <div className="cy-settings-page">
        <header className="cy-settings-page-head">
          <p className="cy-eyebrow">Workspace</p>
          <h1 className="cy-settings-page-title">Organization settings</h1>
          <p className="cy-settings-help">
            Manage org profile and integrations used across PropOS.
          </p>
        </header>

        <OrgSettingsForm
          orgId={org.id}
          initialName={org.name}
          initialProvince={org.province}
          initialLogoPath={org.logo_path}
        />

        <Suspense fallback={null}>
          <GmailIntegrationSection
            orgId={org.id}
            gmailConnectedAt={org.gmail_connected_at ?? null}
          />
        </Suspense>
      </div>
    </CanarySettingsShell>
  )
}
