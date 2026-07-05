/**
 * FOUND-09: Employee scoped access.
 *
 * Verifies that an employee can read/write people and units within their
 * own org (in-org CRUD succeeds) but cannot read or update any Org B rows
 * (cross-org SELECT returns 0; cross-org UPDATE affects 0 rows).
 *
 * The employee is org-scoped, not cross-org.
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

describe('employee scoped access (FOUND-09)', () => {
  let fixture: SeedFixture

  beforeAll(async () => {
    fixture = await seedTwoOrgs()
  }, 60_000)

  afterAll(async () => {
    await fixture.cleanup()
  }, 30_000)

  // ---------------------------------------------------------------------------
  // In-org READ succeeds
  // ---------------------------------------------------------------------------
  it('employee can SELECT people within their own org', async () => {
    const client = await signInAs(
      fixture.orgA.employee.email,
      fixture.orgA.employee.password,
    )

    const { data, error } = await client
      .from('people')
      .select('id, org_id')
      .eq('org_id', fixture.orgA.orgId)

    expect(error).toBeNull()
    // Must see at least their own row
    expect((data ?? []).length).toBeGreaterThan(0)
    // Every returned row must belong to Org A
    for (const row of data ?? []) {
      expect(row.org_id).toBe(fixture.orgA.orgId)
    }
  })

  // ---------------------------------------------------------------------------
  // In-org UPDATE succeeds
  // ---------------------------------------------------------------------------
  it('employee can UPDATE a person in their own org', async () => {
    const client = await signInAs(
      fixture.orgA.employee.email,
      fixture.orgA.employee.password,
    )

    const { data, error } = await client
      .from('people')
      .update({ first_name: 'EmpUpdated' })
      .eq('id', fixture.orgA.tenant1.personId)
      .select('first_name')

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].first_name).toBe('EmpUpdated')
  })

  // ---------------------------------------------------------------------------
  // Cross-org SELECT returns 0 rows
  // ---------------------------------------------------------------------------
  it('employee SELECT of Org B people returns 0 rows', async () => {
    const client = await signInAs(
      fixture.orgA.employee.email,
      fixture.orgA.employee.password,
    )

    const { data, error } = await client
      .from('people')
      .select('id')
      .eq('org_id', fixture.orgB.orgId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // Cross-org UPDATE affects 0 rows
  // ---------------------------------------------------------------------------
  it('employee UPDATE of Org B person affects 0 rows', async () => {
    const client = await signInAs(
      fixture.orgA.employee.email,
      fixture.orgA.employee.password,
    )

    const { data, error } = await client
      .from('people')
      .update({ first_name: 'CrossOrgInjected' })
      .eq('id', fixture.orgB.tenant1.personId)
      .select('id')

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // In-org units READ
  // ---------------------------------------------------------------------------
  it('employee can SELECT units within their own org', async () => {
    // Seed a unit in Org A via service role so employee can read it
    const svc = getServiceClient()
    const { data: unitData } = await svc
      .from('units')
      .insert({ org_id: fixture.orgA.orgId, label: 'Emp-test unit' })
      .select('id')

    expect(unitData).toHaveLength(1)
    const unitId = unitData![0].id

    const client = await signInAs(
      fixture.orgA.employee.email,
      fixture.orgA.employee.password,
    )

    const { data, error } = await client
      .from('units')
      .select('id')
      .eq('id', unitId)

    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)

    // Cleanup
    await svc.from('units').delete().eq('id', unitId)
  })
})
