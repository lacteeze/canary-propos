/**
 * FOUND-05: Cross-org isolation.
 *
 * Verifies that a user authenticated as Org A cannot read, enumerate, or
 * mutate any Org B data. Every RLS assertion here exercises the real DB
 * boundary — not client-side guards.
 *
 * NOTE: Requires Auth Hook registered in Supabase Dashboard
 * (public.custom_access_token_hook). Without it, org_id() returns NULL and
 * ALL rows are returned (false-pass). See docs/supabase-auth-config.md.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedTwoOrgs, signInAs, type SeedFixture } from '../helpers/seed'

describe('cross-org isolation (FOUND-05)', () => {
  let fixture: SeedFixture

  beforeAll(async () => {
    fixture = await seedTwoOrgs()
  }, 60_000)

  afterAll(async () => {
    await fixture.cleanup()
  }, 30_000)

  // ---------------------------------------------------------------------------
  // Org A manager cannot read Org B organizations
  // ---------------------------------------------------------------------------
  it('Org A manager sees only Org A in organizations', async () => {
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
  // Org A manager cannot read Org B people
  // ---------------------------------------------------------------------------
  it('Org A manager sees 0 Org B people rows', async () => {
    const client = await signInAs(
      fixture.orgA.manager.email,
      fixture.orgA.manager.password,
    )

    const { data, error } = await client
      .from('people')
      .select('id')
      .eq('org_id', fixture.orgB.orgId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // Org A manager cannot read Org B units
  // ---------------------------------------------------------------------------
  it('Org A manager sees 0 Org B units rows', async () => {
    const client = await signInAs(
      fixture.orgA.manager.email,
      fixture.orgA.manager.password,
    )

    const { data, error } = await client
      .from('units')
      .select('id')
      .eq('org_id', fixture.orgB.orgId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // Org A manager UPDATE of an Org B people row affects 0 rows
  // ---------------------------------------------------------------------------
  it('Org A manager UPDATE on Org B person affects 0 rows', async () => {
    const client = await signInAs(
      fixture.orgA.manager.email,
      fixture.orgA.manager.password,
    )

    const { data, error } = await client
      .from('people')
      .update({ first_name: 'InjectedName' })
      .eq('id', fixture.orgB.manager.personId)
      .select('id')

    // RLS will silently filter the target row — no error, but 0 rows affected
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // Org A manager DELETE of an Org B people row affects 0 rows
  // ---------------------------------------------------------------------------
  it('Org A manager DELETE on Org B person affects 0 rows', async () => {
    const client = await signInAs(
      fixture.orgA.manager.email,
      fixture.orgA.manager.password,
    )

    const { data, error } = await client
      .from('people')
      .delete()
      .eq('id', fixture.orgB.tenant1.personId)
      .select('id')

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })
})
