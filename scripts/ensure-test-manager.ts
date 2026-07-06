// scripts/ensure-test-manager.ts
// Creates (or repairs) the TEST_MANAGER_* user from .env.local so the
// integration/UAT flows can sign in. Idempotent.
// Run: npx tsx scripts/ensure-test-manager.ts
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.TEST_MANAGER_EMAIL
const password = process.env.TEST_MANAGER_PASSWORD
const orgSlug = process.env.SEED_ORG_SLUG ?? 'canary'

async function main() {
  if (!url || !serviceKey || !email || !password) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / TEST_MANAGER_* env vars')
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .select('id, name, slug')
    .eq('slug', orgSlug)
    .single()
  if (orgErr || !org) throw new Error(`Org with slug "${orgSlug}" not found: ${orgErr?.message}`)

  // find or create the auth user
  let userId: string | undefined
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = list?.users.find((u) => u.email === email)
  if (existing) {
    userId = existing.id
    await admin.auth.admin.updateUserById(userId, { password, email_confirm: true })
    console.log('auth user exists — password reset:', email)
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error || !created.user) throw new Error('createUser failed: ' + error?.message)
    userId = created.user.id
    console.log('auth user created:', email)
  }

  // upsert the people row (role source of truth for the JWT auth hook)
  const { data: person } = await admin
    .from('people')
    .select('id, role')
    .eq('email', email)
    .eq('org_id', org.id)
    .maybeSingle()

  if (person) {
    await admin
      .from('people')
      .update({ user_id: userId, role: ['manager'], active: true, invite_accepted_at: new Date().toISOString() })
      .eq('id', person.id)
    console.log('people row updated:', person.id)
  } else {
    const { data: inserted, error } = await admin
      .from('people')
      .insert({
        org_id: org.id,
        user_id: userId,
        role: ['manager'],
        email,
        first_name: 'Test',
        last_name: 'Manager',
        active: true,
        invite_accepted_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error) throw new Error('people insert failed: ' + error.message)
    console.log('people row created:', inserted.id)
  }

  // Mirror onboarding: inject JWT claims into app_metadata so middleware role
  // guards pass without waiting for the Auth Hook on next sign-in.
  const { data: personRow } = await admin
    .from('people')
    .select('id')
    .eq('email', email)
    .eq('org_id', org.id)
    .single()
  await admin.auth.admin.updateUserById(userId!, {
    app_metadata: { role: 'manager', org_id: org.id, person_id: personRow?.id ?? null },
  })
  console.log('app_metadata claims set')

  console.log('done — sign in with', email)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
