/**
 * FOUND-06: JWT claim injection.
 *
 * Verifies that after sign-in, the access token's app_metadata contains
 * role, org_id, and person_id — all populated and matching the seeded
 * person row.
 *
 * The Auth Hook (public.custom_access_token_hook) must be registered in
 * the Supabase Dashboard for this test to pass. Without registration, all
 * three fields will be absent from app_metadata.
 *
 * See docs/supabase-auth-config.md for registration steps.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedTwoOrgs, signInAs, type SeedFixture } from '../helpers/seed'

describe('JWT claim injection (FOUND-06)', () => {
  let fixture: SeedFixture

  beforeAll(async () => {
    fixture = await seedTwoOrgs()
  }, 60_000)

  afterAll(async () => {
    await fixture.cleanup()
  }, 30_000)

  it('manager JWT contains role, org_id, and person_id in app_metadata', async () => {
    const client = await signInAs(
      fixture.orgA.manager.email,
      fixture.orgA.manager.password,
    )

    const { data: sessionData } = await client.auth.getSession()
    const session = sessionData?.session

    expect(session, 'session must exist after sign-in').toBeTruthy()

    const appMeta = session!.user.app_metadata

    expect(appMeta.role, 'app_metadata.role must be present').toBeTruthy()
    expect(appMeta.org_id, 'app_metadata.org_id must be present').toBeTruthy()
    expect(appMeta.person_id, 'app_metadata.person_id must be present').toBeTruthy()

    expect(appMeta.role).toBe('manager')
    expect(appMeta.org_id).toBe(fixture.orgA.orgId)
    expect(appMeta.person_id).toBe(fixture.orgA.manager.personId)
  })

  it('tenant JWT contains role=tenant, correct org_id, and person_id', async () => {
    const client = await signInAs(
      fixture.orgA.tenant1.email,
      fixture.orgA.tenant1.password,
    )

    const { data: sessionData } = await client.auth.getSession()
    const session = sessionData?.session

    expect(session).toBeTruthy()

    const appMeta = session!.user.app_metadata

    expect(appMeta.role).toBe('tenant')
    expect(appMeta.org_id).toBe(fixture.orgA.orgId)
    expect(appMeta.person_id).toBe(fixture.orgA.tenant1.personId)
  })

  it('employee JWT contains role=employee, correct org_id, and person_id', async () => {
    const client = await signInAs(
      fixture.orgA.employee.email,
      fixture.orgA.employee.password,
    )

    const { data: sessionData } = await client.auth.getSession()
    const session = sessionData?.session

    expect(session).toBeTruthy()

    const appMeta = session!.user.app_metadata

    expect(appMeta.role).toBe('employee')
    expect(appMeta.org_id).toBe(fixture.orgA.orgId)
    expect(appMeta.person_id).toBe(fixture.orgA.employee.personId)
  })

  it('admin JWT contains role=admin and person_id', async () => {
    const client = await signInAs(
      fixture.admin.email,
      fixture.admin.password,
    )

    const { data: sessionData } = await client.auth.getSession()
    const session = sessionData?.session

    expect(session).toBeTruthy()

    const appMeta = session!.user.app_metadata

    expect(appMeta.role).toBe('admin')
    expect(appMeta.person_id).toBe(fixture.admin.personId)
  })

  it('Org B manager JWT has Org B org_id (not Org A)', async () => {
    const client = await signInAs(
      fixture.orgB.manager.email,
      fixture.orgB.manager.password,
    )

    const { data: sessionData } = await client.auth.getSession()
    const appMeta = sessionData?.session?.user.app_metadata ?? {}

    expect(appMeta.org_id).toBe(fixture.orgB.orgId)
    expect(appMeta.org_id).not.toBe(fixture.orgA.orgId)
  })
})
