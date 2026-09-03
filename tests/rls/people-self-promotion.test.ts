/**
 * B2: a tenant cannot change their own role (or other privileged columns).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { seedTwoOrgs, signInAs, type SeedFixture } from '../helpers/seed'
import { hasSupabaseTestEnv, supabaseTestUrl } from '../helpers/supabase-env'
import type { Database } from '@/types/supabase'

function getServiceClient() {
  return createClient<Database>(
    supabaseTestUrl()!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

describe.skipIf(!hasSupabaseTestEnv())('B2 people privileged columns', () => {
  let fixture: SeedFixture

  beforeAll(async () => {
    fixture = await seedTwoOrgs()
  }, 60_000)

  afterAll(async () => {
    await fixture.cleanup()
  }, 30_000)

  it('tenant cannot change their own role', async () => {
    const tenant = await signInAs(
      fixture.orgA.tenant1.email,
      fixture.orgA.tenant1.password,
    )

    await tenant
      .from('people')
      .update({ role: ['admin'] })
      .eq('id', fixture.orgA.tenant1.personId)

    const service = getServiceClient()
    const { data, error } = await service
      .from('people')
      .select('role')
      .eq('id', fixture.orgA.tenant1.personId)
      .single()

    expect(error).toBeNull()
    const roles = Array.isArray(data?.role) ? data.role : [data?.role]
    expect(roles).not.toContain('admin')
    expect(roles.some((r) => String(r).includes('tenant'))).toBe(true)
  })
})
