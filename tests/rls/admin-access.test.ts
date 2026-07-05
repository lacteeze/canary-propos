/**
 * FOUND-07: Admin cross-org access vs manager single-org access.
 *
 * Verifies that a platform admin can SELECT rows from both orgs, while a
 * manager only sees their own org's rows. Exercises the admin bypass RLS
 * policies on organizations and people.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedTwoOrgs, signInAs, type SeedFixture } from '../helpers/seed'

describe('admin cross-org access (FOUND-07)', () => {
  let fixture: SeedFixture

  beforeAll(async () => {
    fixture = await seedTwoOrgs()
  }, 60_000)

  afterAll(async () => {
    await fixture.cleanup()
  }, 30_000)

  // ---------------------------------------------------------------------------
  // Admin sees both orgs; manager sees only one
  // ---------------------------------------------------------------------------
  it('admin SELECT on organizations returns both Org A and Org B', async () => {
    const client = await signInAs(fixture.admin.email, fixture.admin.password)

    const { data, error } = await client.from('organizations').select('id')

    expect(error).toBeNull()
    const ids = (data ?? []).map((r) => r.id)
    expect(ids).toContain(fixture.orgA.orgId)
    expect(ids).toContain(fixture.orgB.orgId)
  })

  it('Org A manager SELECT on organizations returns only Org A', async () => {
    const client = await signInAs(
      fixture.orgA.manager.email,
      fixture.orgA.manager.password,
    )

    const { data, error } = await client.from('organizations').select('id')

    expect(error).toBeNull()
    const ids = (data ?? []).map((r) => r.id)
    expect(ids).toContain(fixture.orgA.orgId)
    expect(ids).not.toContain(fixture.orgB.orgId)
  })

  // ---------------------------------------------------------------------------
  // Admin sees people from both orgs; manager sees only own org
  // ---------------------------------------------------------------------------
  it('admin SELECT on people returns rows from both orgs', async () => {
    const client = await signInAs(fixture.admin.email, fixture.admin.password)

    const { data, error } = await client
      .from('people')
      .select('id, org_id')
      .in('org_id', [fixture.orgA.orgId, fixture.orgB.orgId])

    expect(error).toBeNull()
    const orgIds = new Set((data ?? []).map((r) => r.org_id))
    expect(orgIds.has(fixture.orgA.orgId)).toBe(true)
    expect(orgIds.has(fixture.orgB.orgId)).toBe(true)
  })

  it('Org A manager SELECT on people returns only Org A rows', async () => {
    const client = await signInAs(
      fixture.orgA.manager.email,
      fixture.orgA.manager.password,
    )

    const { data, error } = await client
      .from('people')
      .select('id, org_id')

    expect(error).toBeNull()
    const orgIds = new Set((data ?? []).map((r) => r.org_id))
    expect(orgIds.has(fixture.orgA.orgId)).toBe(true)
    expect(orgIds.has(fixture.orgB.orgId)).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // Admin UPDATE on Org B organization succeeds (not filtered)
  // ---------------------------------------------------------------------------
  it('admin can UPDATE Org B organization name', async () => {
    const client = await signInAs(fixture.admin.email, fixture.admin.password)

    const newName = `Seed Org B (admin-updated-${Date.now()})`
    const { data, error } = await client
      .from('organizations')
      .update({ name: newName })
      .eq('id', fixture.orgB.orgId)
      .select('name')

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)
    expect(data![0].name).toBe(newName)
  })
})
