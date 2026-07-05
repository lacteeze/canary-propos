/**
 * Per-role authenticated Supabase test client factory.
 *
 * Usage:
 *   const client = await createTestClient('manager')
 *   const { data } = await client.from('properties').select('*')
 *
 * Each role maps to a test user whose credentials are stored in env vars:
 *   TEST_<ROLE>_EMAIL / TEST_<ROLE>_PASSWORD
 *
 * These users must be created in Supabase Auth before running integration tests.
 * See .env.example for the expected env var names.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export type TestRole = 'manager' | 'employee' | 'tenant' | 'owner' | 'vendor' | 'admin'

/**
 * Returns an authenticated Supabase client signed in as a test user for the
 * given role. The client uses the anon key and signs in with email/password
 * credentials read from environment variables.
 *
 * Throws if the sign-in fails (check env vars and that the test user exists).
 */
export async function createTestClient(role: TestRole) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set to run integration tests.'
    )
  }

  const roleUpper = role.toUpperCase()
  const email = process.env[`TEST_${roleUpper}_EMAIL`]
  const password = process.env[`TEST_${roleUpper}_PASSWORD`]

  if (!email || !password) {
    throw new Error(
      `TEST_${roleUpper}_EMAIL and TEST_${roleUpper}_PASSWORD must be set to create a test client for role '${role}'.`
    )
  }

  const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { error } = await client.auth.signInWithPassword({ email, password })

  if (error) {
    throw new Error(
      `Failed to sign in as ${role} (${email}): ${error.message}. ` +
        `Ensure the test user exists in Supabase Auth and credentials are correct.`
    )
  }

  return client
}
