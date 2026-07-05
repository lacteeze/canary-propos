/**
 * Two-org seed fixture for RLS integration tests.
 *
 * Creates:
 *   - Org A and Org B (organizations)
 *   - Per org: 1 manager, 1 employee, 2 tenants, 2 owners, 2 vendors (all with auth users)
 *   - 1 platform admin (no org affiliation)
 *
 * Uses the service_role client to bypass RLS during seeding and to set
 * app_metadata on auth users (which the Auth Hook will read at sign-in).
 *
 * Teardown: call cleanup() to delete all seeded rows in reverse-dependency order.
 *
 * NOTE: The Auth Hook (public.custom_access_token_hook) must be registered in
 * the Supabase Dashboard for JWT claims to be injected. Without it, all
 * RLS tests will see NULL org_id/role/person_id and return 0 rows for every
 * authenticated query.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// ---------------------------------------------------------------------------
// Service-role client (bypasses RLS — seeding only)
// ---------------------------------------------------------------------------
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to seed test fixtures.'
    )
  }

  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SeedUser {
  userId: string
  personId: string
  email: string
  password: string
}

export interface SeedOrg {
  orgId: string
  manager: SeedUser
  employee: SeedUser
  tenant1: SeedUser
  tenant2: SeedUser
  owner1: SeedUser
  owner2: SeedUser
  vendor1: SeedUser
  vendor2: SeedUser
}

export interface SeedFixture {
  orgA: SeedOrg
  orgB: SeedOrg
  admin: SeedUser
  cleanup: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let _seedCounter = Date.now()
function uid(): string {
  return (++_seedCounter).toString(36)
}

function makeEmail(role: string, org: string): string {
  return `test-${org}-${role}-${uid()}@canary-test.invalid`
}

const TEST_PASSWORD = 'TestPassword123!'

async function createAuthUser(
  service: ReturnType<typeof getServiceClient>,
  email: string,
  role: string,
): Promise<string> {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    // app_metadata will be patched after the people row is created
  })

  if (error || !data.user) {
    throw new Error(`Failed to create auth user ${email}: ${error?.message}`)
  }

  return data.user.id
}

async function createPersonRow(
  service: ReturnType<typeof getServiceClient>,
  opts: {
    userId: string
    orgId: string
    role: string
    email: string
  },
): Promise<string> {
  const { data, error } = await service
    .from('people')
    .insert({
      user_id: opts.userId,
      org_id: opts.orgId,
      role: opts.role,
      email: opts.email,
      first_name: opts.role,
      last_name: 'Test',
      active: true,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(
      `Failed to insert people row for ${opts.email}: ${error?.message}`
    )
  }

  return data.id
}

async function patchAppMetadata(
  service: ReturnType<typeof getServiceClient>,
  userId: string,
  orgId: string,
  role: string,
  personId: string,
): Promise<void> {
  const { error } = await service.auth.admin.updateUserById(userId, {
    app_metadata: { org_id: orgId, role, person_id: personId },
  })

  if (error) {
    throw new Error(
      `Failed to patch app_metadata for user ${userId}: ${error.message}`
    )
  }
}

async function createOrgUser(
  service: ReturnType<typeof getServiceClient>,
  orgId: string,
  role: string,
  orgLabel: string,
): Promise<SeedUser> {
  const email = makeEmail(role, orgLabel)
  const userId = await createAuthUser(service, email, role)
  const personId = await createPersonRow(service, { userId, orgId, role, email })
  await patchAppMetadata(service, userId, orgId, role, personId)

  return { userId, personId, email, password: TEST_PASSWORD }
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------
export async function seedTwoOrgs(): Promise<SeedFixture> {
  const service = getServiceClient()

  // -- Create Org A and Org B --
  const { data: orgsData, error: orgsError } = await service
    .from('organizations')
    .insert([
      {
        name: 'Seed Org A',
        slug: `seed-org-a-${uid()}`,
        province: 'ON',
        plan_type: 'starter',
        plan_unit_limit: 10,
      },
      {
        name: 'Seed Org B',
        slug: `seed-org-b-${uid()}`,
        province: 'BC',
        plan_type: 'starter',
        plan_unit_limit: 10,
      },
    ])
    .select('id')

  if (orgsError || !orgsData || orgsData.length < 2) {
    throw new Error(`Failed to create orgs: ${orgsError?.message}`)
  }

  const orgAId = orgsData[0].id
  const orgBId = orgsData[1].id

  // -- Seed per-org users (parallelised within each org) --
  const [orgAUsers, orgBUsers] = await Promise.all([
    Promise.all([
      createOrgUser(service, orgAId, 'manager', 'a'),
      createOrgUser(service, orgAId, 'employee', 'a'),
      createOrgUser(service, orgAId, 'tenant', 'a1'),
      createOrgUser(service, orgAId, 'tenant', 'a2'),
      createOrgUser(service, orgAId, 'owner', 'a1'),
      createOrgUser(service, orgAId, 'owner', 'a2'),
      createOrgUser(service, orgAId, 'vendor', 'a1'),
      createOrgUser(service, orgAId, 'vendor', 'a2'),
    ]),
    Promise.all([
      createOrgUser(service, orgBId, 'manager', 'b'),
      createOrgUser(service, orgBId, 'employee', 'b'),
      createOrgUser(service, orgBId, 'tenant', 'b1'),
      createOrgUser(service, orgBId, 'tenant', 'b2'),
      createOrgUser(service, orgBId, 'owner', 'b1'),
      createOrgUser(service, orgBId, 'owner', 'b2'),
      createOrgUser(service, orgBId, 'vendor', 'b1'),
      createOrgUser(service, orgBId, 'vendor', 'b2'),
    ]),
  ])

  // -- Platform admin (no org) --
  const adminEmail = makeEmail('admin', 'platform')
  const adminUserId = await createAuthUser(service, adminEmail, 'admin')
  // Admin has no org_id; person row created without org to validate cross-org policy
  // For simplicity we insert admin into Org A's org — RLS admin policy ignores org_id
  const adminPersonId = await createPersonRow(service, {
    userId: adminUserId,
    orgId: orgAId,
    role: 'admin',
    email: adminEmail,
  })
  await patchAppMetadata(service, adminUserId, orgAId, 'admin', adminPersonId)

  const orgA: SeedOrg = {
    orgId: orgAId,
    manager: orgAUsers[0],
    employee: orgAUsers[1],
    tenant1: orgAUsers[2],
    tenant2: orgAUsers[3],
    owner1: orgAUsers[4],
    owner2: orgAUsers[5],
    vendor1: orgAUsers[6],
    vendor2: orgAUsers[7],
  }

  const orgB: SeedOrg = {
    orgId: orgBId,
    manager: orgBUsers[0],
    employee: orgBUsers[1],
    tenant1: orgBUsers[2],
    tenant2: orgBUsers[3],
    owner1: orgBUsers[4],
    owner2: orgBUsers[5],
    vendor1: orgBUsers[6],
    vendor2: orgBUsers[7],
  }

  const adminUser: SeedUser = {
    userId: adminUserId,
    personId: adminPersonId,
    email: adminEmail,
    password: TEST_PASSWORD,
  }

  // -- Collect all user IDs + org IDs for cleanup --
  const allUserIds = [
    ...orgAUsers.map((u) => u.userId),
    ...orgBUsers.map((u) => u.userId),
    adminUserId,
  ]
  const allOrgIds = [orgAId, orgBId]

  async function cleanup(): Promise<void> {
    const svc = getServiceClient()

    // Delete units first (FK → organizations)
    await svc.from('units').delete().in('org_id', allOrgIds)

    // Delete people rows (FK → organizations)
    await svc.from('people').delete().in('org_id', allOrgIds)

    // Delete auth users
    await Promise.all(
      allUserIds.map((id) => svc.auth.admin.deleteUser(id))
    )

    // Delete organizations
    await svc.from('organizations').delete().in('id', allOrgIds)
  }

  return { orgA, orgB, admin: adminUser, cleanup }
}

// ---------------------------------------------------------------------------
// Authenticated anon client factory (for per-user test clients)
// ---------------------------------------------------------------------------
export async function signInAs(
  email: string,
  password: string,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.'
    )
  }

  const client = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await client.auth.signInWithPassword({ email, password })

  if (error) {
    throw new Error(`signInAs(${email}) failed: ${error.message}`)
  }

  return client
}
