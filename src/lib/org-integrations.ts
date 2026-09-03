import { createAdminClient } from '@/lib/supabase/admin'

export type OrgIntegrationProvider = 'gmail' | 'drive' | 'tasks'

export type OrgIntegrationTokens = {
  access_token: string | null
  refresh_token: string | null
  token_expiry: number | null
  connected_email: string | null
}

export async function getOrgIntegration(
  orgId: string,
  provider: OrgIntegrationProvider,
): Promise<OrgIntegrationTokens | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('org_integrations')
    .select('access_token, refresh_token, token_expiry, connected_email')
    .eq('org_id', orgId)
    .eq('provider', provider)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to read ${provider} integration.`)
  }
  return data
}

export async function upsertOrgIntegration(
  orgId: string,
  provider: OrgIntegrationProvider,
  tokens: {
    access_token?: string | null
    refresh_token?: string | null
    token_expiry?: number | null
    connected_email?: string | null
  },
): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('org_integrations').upsert(
    {
      org_id: orgId,
      provider,
      ...tokens,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'org_id,provider' },
  )

  if (error) {
    throw new Error(`Failed to save ${provider} integration.`)
  }
}

export async function deleteOrgIntegration(
  orgId: string,
  provider: OrgIntegrationProvider,
): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('org_integrations')
    .delete()
    .eq('org_id', orgId)
    .eq('provider', provider)

  if (error) {
    throw new Error(`Failed to disconnect ${provider} integration.`)
  }
}
