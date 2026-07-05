/**
 * ORGS-05 / ORGS-06: DB-enforced plan unit limit.
 *
 * Verifies that the enforce_plan_unit_limit() BEFORE INSERT trigger physically
 * rejects a unit INSERT when the count already equals plan_unit_limit.
 *
 * Test sequence:
 *   1. Set Org A plan_unit_limit = 2 (via admin client or service role)
 *   2. INSERT unit 1 → succeeds
 *   3. INSERT unit 2 → succeeds
 *   4. INSERT unit 3 → MUST be rejected by DB trigger
 *   5. Raise limit to 3 → INSERT unit 3 → succeeds again
 *
 * The rejection MUST come from the DB layer (Postgres check_violation).
 * This is ORGS-06: the trigger is the authoritative gate — not a UI check.
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

describe('plan unit limit enforcement (ORGS-05/06)', () => {
  let fixture: SeedFixture
  const insertedUnitIds: string[] = []

  beforeAll(async () => {
    fixture = await seedTwoOrgs()

    // Set plan_unit_limit = 2 on Org A via service role
    const svc = getServiceClient()
    const { error } = await svc
      .from('organizations')
      .update({ plan_unit_limit: 2 })
      .eq('id', fixture.orgA.orgId)

    if (error) throw new Error(`Failed to set plan_unit_limit: ${error.message}`)
  }, 60_000)

  afterAll(async () => {
    // Clean up all units seeded during this test suite
    if (insertedUnitIds.length > 0) {
      const svc = getServiceClient()
      await svc.from('units').delete().in('id', insertedUnitIds)
    }
    await fixture.cleanup()
  }, 30_000)

  // ---------------------------------------------------------------------------
  // Helper to insert a unit via manager client (not service role — tests RLS too)
  // ---------------------------------------------------------------------------
  async function insertUnit(label: string) {
    const client = await signInAs(
      fixture.orgA.manager.email,
      fixture.orgA.manager.password,
    )

    return client
      .from('units')
      .insert({ org_id: fixture.orgA.orgId, label })
      .select('id')
  }

  // ---------------------------------------------------------------------------
  // Unit 1 — should succeed
  // ---------------------------------------------------------------------------
  it('first unit INSERT succeeds (count 0 → 1, limit 2)', async () => {
    const { data, error } = await insertUnit('Unit-1')

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    insertedUnitIds.push(data![0].id)
  })

  // ---------------------------------------------------------------------------
  // Unit 2 — should succeed
  // ---------------------------------------------------------------------------
  it('second unit INSERT succeeds (count 1 → 2, limit 2)', async () => {
    const { data, error } = await insertUnit('Unit-2')

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    insertedUnitIds.push(data![0].id)
  })

  // ---------------------------------------------------------------------------
  // Unit 3 — MUST be rejected by the DB trigger
  // ---------------------------------------------------------------------------
  it('third unit INSERT is rejected by DB trigger (count 2 = limit 2)', async () => {
    const { data, error } = await insertUnit('Unit-3 (over limit)')

    // The trigger raises a check_violation — Supabase JS returns a non-null error
    expect(error).not.toBeNull()

    // The error should reference the limit constraint
    const errorText = (error!.message ?? '') + (error!.code ?? '') + ((error as any)?.details ?? '')
    const mentionsLimit = /plan_unit_limit|unit.limit|check.*violation/i.test(errorText)
    expect(mentionsLimit, `Expected error to reference plan_unit_limit, got: ${errorText}`).toBe(true)

    // No row should have been inserted
    expect(data ?? []).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // Raise limit and verify INSERT succeeds again
  // ---------------------------------------------------------------------------
  it('after raising plan_unit_limit to 3, a third unit INSERT succeeds', async () => {
    // Raise limit via service role
    const svc = getServiceClient()
    await svc
      .from('organizations')
      .update({ plan_unit_limit: 3 })
      .eq('id', fixture.orgA.orgId)

    const { data, error } = await insertUnit('Unit-3 (now within limit)')

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    insertedUnitIds.push(data![0].id)
  })

  // ---------------------------------------------------------------------------
  // Org B is unaffected by Org A's limit
  // ---------------------------------------------------------------------------
  it('Org B can still insert units regardless of Org A limit state', async () => {
    const client = await signInAs(
      fixture.orgB.manager.email,
      fixture.orgB.manager.password,
    )

    const { data, error } = await client
      .from('units')
      .insert({ org_id: fixture.orgB.orgId, label: 'OrgB-Unit' })
      .select('id')

    expect(error).toBeNull()
    expect(data).toHaveLength(1)

    // Cleanup this unit immediately via service role
    const svc = getServiceClient()
    await svc.from('units').delete().eq('id', data![0].id)
  })
})
