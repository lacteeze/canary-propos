/**
 * FOUND-10: Within-org tenant isolation.
 *
 * Verifies that tenant1 (Org A) can only read their own people row.
 * They cannot read tenant2's row within the same org, and cannot read any
 * row from Org B.
 *
 * The "self-row only" policy for non-staff roles is enforced by:
 *   user_id = auth.uid() AND org_id = (SELECT public.org_id())
 *   AND (SELECT public.user_role()) IN ('tenant', 'owner', 'vendor')
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedTwoOrgs, signInAs, type SeedFixture } from '../helpers/seed'

describe('tenant within-org isolation (FOUND-10)', () => {
  let fixture: SeedFixture

  beforeAll(async () => {
    fixture = await seedTwoOrgs()
  }, 60_000)

  afterAll(async () => {
    await fixture.cleanup()
  }, 30_000)

  // ---------------------------------------------------------------------------
  // Tenant can read their own row
  // ---------------------------------------------------------------------------
  it('tenant1 can SELECT their own people row', async () => {
    const client = await signInAs(
      fixture.orgA.tenant1.email,
      fixture.orgA.tenant1.password,
    )

    const { data, error } = await client
      .from('people')
      .select('id')
      .eq('id', fixture.orgA.tenant1.personId)

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].id).toBe(fixture.orgA.tenant1.personId)
  })

  // ---------------------------------------------------------------------------
  // Tenant cannot read another tenant's row within the same org
  // ---------------------------------------------------------------------------
  it('tenant1 cannot SELECT tenant2 row within the same Org A (returns 0)', async () => {
    const client = await signInAs(
      fixture.orgA.tenant1.email,
      fixture.orgA.tenant1.password,
    )

    const { data, error } = await client
      .from('people')
      .select('id')
      .eq('id', fixture.orgA.tenant2.personId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // Tenant cannot read any Org B rows
  // ---------------------------------------------------------------------------
  it('tenant1 SELECT of any Org B people row returns 0', async () => {
    const client = await signInAs(
      fixture.orgA.tenant1.email,
      fixture.orgA.tenant1.password,
    )

    const { data, error } = await client
      .from('people')
      .select('id')
      .eq('org_id', fixture.orgB.orgId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // Tenant SELECT on organizations returns only own org
  // ---------------------------------------------------------------------------
  it('tenant1 SELECT on organizations returns only Org A', async () => {
    const client = await signInAs(
      fixture.orgA.tenant1.email,
      fixture.orgA.tenant1.password,
    )

    const { data, error } = await client.from('organizations').select('id')

    expect(error).toBeNull()
    const ids = (data ?? []).map((r) => r.id)
    expect(ids).not.toContain(fixture.orgB.orgId)
  })

  // ---------------------------------------------------------------------------
  // Tenant SELECT returns only self (not manager, not employee)
  // ---------------------------------------------------------------------------
  it('tenant1 SELECT of all people returns only their own row', async () => {
    const client = await signInAs(
      fixture.orgA.tenant1.email,
      fixture.orgA.tenant1.password,
    )

    const { data, error } = await client.from('people').select('id')

    expect(error).toBeNull()
    const ids = (data ?? []).map((r) => r.id)
    // Self-row must be present
    expect(ids).toContain(fixture.orgA.tenant1.personId)
    // Other org-A people must NOT be visible
    expect(ids).not.toContain(fixture.orgA.manager.personId)
    expect(ids).not.toContain(fixture.orgA.tenant2.personId)
  })
})
