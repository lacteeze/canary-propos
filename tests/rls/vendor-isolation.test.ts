/**
 * FOUND-12: Within-org vendor isolation.
 *
 * Verifies that vendor1 (Org A) can only read their own people row.
 * They cannot read vendor2's row within the same org, and cannot read any
 * row from Org B.
 *
 * Same RLS self-read policy as tenants and owners:
 *   user_id = auth.uid() AND org_id = (SELECT public.org_id())
 *   AND (SELECT public.user_role()) IN ('tenant', 'owner', 'vendor')
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedTwoOrgs, signInAs, type SeedFixture } from '../helpers/seed'

describe('vendor within-org isolation (FOUND-12)', () => {
  let fixture: SeedFixture

  beforeAll(async () => {
    fixture = await seedTwoOrgs()
  }, 60_000)

  afterAll(async () => {
    await fixture.cleanup()
  }, 30_000)

  // ---------------------------------------------------------------------------
  // Vendor can read their own row
  // ---------------------------------------------------------------------------
  it('vendor1 can SELECT their own people row', async () => {
    const client = await signInAs(
      fixture.orgA.vendor1.email,
      fixture.orgA.vendor1.password,
    )

    const { data, error } = await client
      .from('people')
      .select('id')
      .eq('id', fixture.orgA.vendor1.personId)

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].id).toBe(fixture.orgA.vendor1.personId)
  })

  // ---------------------------------------------------------------------------
  // Vendor cannot read another vendor's row within the same org
  // ---------------------------------------------------------------------------
  it('vendor1 cannot SELECT vendor2 row within Org A (returns 0)', async () => {
    const client = await signInAs(
      fixture.orgA.vendor1.email,
      fixture.orgA.vendor1.password,
    )

    const { data, error } = await client
      .from('people')
      .select('id')
      .eq('id', fixture.orgA.vendor2.personId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // Vendor cannot read tenant or owner rows in same org
  // ---------------------------------------------------------------------------
  it('vendor1 cannot SELECT tenant or owner rows within Org A', async () => {
    const client = await signInAs(
      fixture.orgA.vendor1.email,
      fixture.orgA.vendor1.password,
    )

    const { data, error } = await client
      .from('people')
      .select('id')
      .in('id', [
        fixture.orgA.tenant1.personId,
        fixture.orgA.owner1.personId,
      ])

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // Vendor cannot read any Org B rows
  // ---------------------------------------------------------------------------
  it('vendor1 SELECT of Org B people returns 0 rows', async () => {
    const client = await signInAs(
      fixture.orgA.vendor1.email,
      fixture.orgA.vendor1.password,
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
  it('vendor1 SELECT of all people returns only their own row', async () => {
    const client = await signInAs(
      fixture.orgA.vendor1.email,
      fixture.orgA.vendor1.password,
    )

    const { data, error } = await client.from('people').select('id')

    expect(error).toBeNull()
    const ids = (data ?? []).map((r) => r.id)
    expect(ids).toContain(fixture.orgA.vendor1.personId)
    expect(ids).not.toContain(fixture.orgA.vendor2.personId)
    expect(ids).not.toContain(fixture.orgA.tenant1.personId)
    expect(ids).not.toContain(fixture.orgA.owner1.personId)
    expect(ids).not.toContain(fixture.orgA.manager.personId)
  })

  // ---------------------------------------------------------------------------
  // Vendor SELECT on organizations does not return Org B
  // ---------------------------------------------------------------------------
  it('vendor1 SELECT on organizations does not return Org B', async () => {
    const client = await signInAs(
      fixture.orgA.vendor1.email,
      fixture.orgA.vendor1.password,
    )

    const { data, error } = await client.from('organizations').select('id')

    expect(error).toBeNull()
    const ids = (data ?? []).map((r) => r.id)
    expect(ids).not.toContain(fixture.orgB.orgId)
  })
})
