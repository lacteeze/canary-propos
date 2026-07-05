/**
 * FOUND-11: Within-org owner isolation.
 *
 * Verifies that owner1 (Org A) can only read their own people row.
 * They cannot read owner2's row within the same org, and cannot read any
 * row from Org B.
 *
 * Same RLS self-read policy as tenants:
 *   user_id = auth.uid() AND org_id = (SELECT public.org_id())
 *   AND (SELECT public.user_role()) IN ('tenant', 'owner', 'vendor')
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedTwoOrgs, signInAs, type SeedFixture } from '../helpers/seed'

describe('owner within-org isolation (FOUND-11)', () => {
  let fixture: SeedFixture

  beforeAll(async () => {
    fixture = await seedTwoOrgs()
  }, 60_000)

  afterAll(async () => {
    await fixture.cleanup()
  }, 30_000)

  // ---------------------------------------------------------------------------
  // Owner can read their own row
  // ---------------------------------------------------------------------------
  it('owner1 can SELECT their own people row', async () => {
    const client = await signInAs(
      fixture.orgA.owner1.email,
      fixture.orgA.owner1.password,
    )

    const { data, error } = await client
      .from('people')
      .select('id')
      .eq('id', fixture.orgA.owner1.personId)

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].id).toBe(fixture.orgA.owner1.personId)
  })

  // ---------------------------------------------------------------------------
  // Owner cannot read another owner's row within the same org
  // ---------------------------------------------------------------------------
  it('owner1 cannot SELECT owner2 row within Org A (returns 0)', async () => {
    const client = await signInAs(
      fixture.orgA.owner1.email,
      fixture.orgA.owner1.password,
    )

    const { data, error } = await client
      .from('people')
      .select('id')
      .eq('id', fixture.orgA.owner2.personId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // Owner cannot read manager or employee rows within same org
  // ---------------------------------------------------------------------------
  it('owner1 cannot SELECT manager or employee rows within Org A', async () => {
    const client = await signInAs(
      fixture.orgA.owner1.email,
      fixture.orgA.owner1.password,
    )

    const { data, error } = await client
      .from('people')
      .select('id')
      .in('id', [
        fixture.orgA.manager.personId,
        fixture.orgA.employee.personId,
      ])

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // Owner cannot read any Org B rows
  // ---------------------------------------------------------------------------
  it('owner1 SELECT of Org B people returns 0 rows', async () => {
    const client = await signInAs(
      fixture.orgA.owner1.email,
      fixture.orgA.owner1.password,
    )

    const { data, error } = await client
      .from('people')
      .select('id')
      .eq('org_id', fixture.orgB.orgId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // Full SELECT returns self-only
  // ---------------------------------------------------------------------------
  it('owner1 SELECT of all people returns only their own row', async () => {
    const client = await signInAs(
      fixture.orgA.owner1.email,
      fixture.orgA.owner1.password,
    )

    const { data, error } = await client.from('people').select('id')

    expect(error).toBeNull()
    const ids = (data ?? []).map((r) => r.id)
    expect(ids).toContain(fixture.orgA.owner1.personId)
    expect(ids).not.toContain(fixture.orgA.owner2.personId)
    expect(ids).not.toContain(fixture.orgA.tenant1.personId)
    expect(ids).not.toContain(fixture.orgA.manager.personId)
  })

  // ---------------------------------------------------------------------------
  // Owner SELECT on organizations returns only own org
  // ---------------------------------------------------------------------------
  it('owner1 SELECT on organizations does not return Org B', async () => {
    const client = await signInAs(
      fixture.orgA.owner1.email,
      fixture.orgA.owner1.password,
    )

    const { data, error } = await client.from('organizations').select('id')

    expect(error).toBeNull()
    const ids = (data ?? []).map((r) => r.id)
    expect(ids).not.toContain(fixture.orgB.orgId)
  })
})
