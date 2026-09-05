/**
 * B1: anon cannot read OAuth tokens on org_integrations or organizations.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { seedTwoOrgs, type SeedFixture } from '../helpers/seed'
import { hasSupabaseTestEnv, supabaseTestUrl } from '../helpers/supabase-env'
import type { Database } from '@/types/supabase'

function getAnonClient() {
  return createClient<Database>(
    supabaseTestUrl()!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function getServiceClient() {
  return createClient<Database>(
    supabaseTestUrl()!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

describe.skipIf(!hasSupabaseTestEnv())('B1 org integration tokens', () => {
  let fixture: SeedFixture

  beforeAll(async () => {
    fixture = await seedTwoOrgs()
    const service = getServiceClient()
    const { error } = await service.from('org_integrations').upsert({
      org_id: fixture.orgA.orgId,
      provider: 'gmail',
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_expiry: Date.now() + 3600_000,
    })
    if (error) throw new Error(`Failed to seed org_integrations: ${error.message}`)
  }, 60_000)

  afterAll(async () => {
    await fixture.cleanup()
  }, 30_000)

  it('anon cannot SELECT org_integrations tokens', async () => {
    const anon = getAnonClient()
    const { data, error } = await anon
      .from('org_integrations')
      .select('access_token, refresh_token')
      .eq('org_id', fixture.orgA.orgId)

    expect(data === null || data.length === 0).toBe(true)
    if (error) {
      expect(error.message.length).toBeGreaterThan(0)
    }
  })

  it('anon cannot SELECT organizations rows (tokens live elsewhere)', async () => {
    const anon = getAnonClient()
    const { data, error } = await anon
      .from('organizations')
      .select('id, slug')
      .eq('id', fixture.orgA.orgId)

    expect(data === null || data.length === 0).toBe(true)
    expect(error).not.toBeNull()
  })
})
