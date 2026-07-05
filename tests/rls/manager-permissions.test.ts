/**
 * FOUND-08: Manager CRUD within own org.
 *
 * Verifies that a manager can INSERT, UPDATE, and DELETE people rows within
 * their own org, and that those operations are reflected back correctly.
 * Exercises the manager-specific RLS policies on public.people.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { seedTwoOrgs, signInAs, type SeedFixture } from '../helpers/seed'
import type { Database } from '@/types/supabase'

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

describe('manager CRUD within own org (FOUND-08)', () => {
  let fixture: SeedFixture
  const insertedPersonIds: string[] = []

  beforeAll(async () => {
    fixture = await seedTwoOrgs()
  }, 60_000)

  afterAll(async () => {
    // Clean up any people rows created during tests (service role bypasses RLS)
    if (insertedPersonIds.length > 0) {
      const svc = getServiceClient()
      await svc.from('people').delete().in('id', insertedPersonIds)
    }
    await fixture.cleanup()
  }, 30_000)

  // ---------------------------------------------------------------------------
  // INSERT
  // ---------------------------------------------------------------------------
  it('manager can INSERT a new person into their org', async () => {
    const client = await signInAs(
      fixture.orgA.manager.email,
      fixture.orgA.manager.password,
    )

    const { data, error } = await client
      .from('people')
      .insert({
        org_id: fixture.orgA.orgId,
        role: 'tenant',
        email: `mgr-insert-${Date.now()}@test.invalid`,
        first_name: 'Invited',
        last_name: 'Tenant',
        active: true,
      })
      .select('id, org_id, role')

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].org_id).toBe(fixture.orgA.orgId)
    expect(data![0].role).toBe('tenant')
    insertedPersonIds.push(data![0].id)
  })

  // ---------------------------------------------------------------------------
  // SELECT (confirming the inserted row is readable back)
  // ---------------------------------------------------------------------------
  it('manager can SELECT the newly inserted person', async () => {
    // Ensure at least one inserted person exists
    expect(insertedPersonIds.length).toBeGreaterThan(0)

    const client = await signInAs(
      fixture.orgA.manager.email,
      fixture.orgA.manager.password,
    )

    const { data, error } = await client
      .from('people')
      .select('id')
      .eq('id', insertedPersonIds[0])

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------
  it('manager can UPDATE a person in their org', async () => {
    const client = await signInAs(
      fixture.orgA.manager.email,
      fixture.orgA.manager.password,
    )

    const { data, error } = await client
      .from('people')
      .update({ first_name: 'UpdatedName' })
      .eq('id', fixture.orgA.employee.personId)
      .select('first_name')

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].first_name).toBe('UpdatedName')
  })

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------
  it('manager can DELETE a person they inserted', async () => {
    // First insert a throwaway person
    const mgr = await signInAs(
      fixture.orgA.manager.email,
      fixture.orgA.manager.password,
    )

    const { data: insertData } = await mgr
      .from('people')
      .insert({
        org_id: fixture.orgA.orgId,
        role: 'vendor',
        email: `mgr-delete-${Date.now()}@test.invalid`,
        active: true,
      })
      .select('id')

    expect(insertData).toHaveLength(1)
    const throwawayId = insertData![0].id

    // Now delete it
    const { data: deleteData, error } = await mgr
      .from('people')
      .delete()
      .eq('id', throwawayId)
      .select('id')

    expect(error).toBeNull()
    expect(deleteData).toHaveLength(1)
    expect(deleteData![0].id).toBe(throwawayId)
  })

  // ---------------------------------------------------------------------------
  // Manager cannot INSERT into Org B
  // ---------------------------------------------------------------------------
  it('manager INSERT with Org B org_id is rejected or silently filtered', async () => {
    const client = await signInAs(
      fixture.orgA.manager.email,
      fixture.orgA.manager.password,
    )

    const { data, error } = await client
      .from('people')
      .insert({
        org_id: fixture.orgB.orgId,
        role: 'tenant',
        email: `cross-org-inject-${Date.now()}@test.invalid`,
        active: true,
      })
      .select('id')

    // RLS WITH CHECK rejects the row — expect error or empty result
    const affected = data ?? []
    const wasRejected = error !== null || affected.length === 0
    expect(wasRejected).toBe(true)
  })
})
