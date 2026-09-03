/**
 * Env gate for Postgres/Auth integration suites (tests/rls, tests/auth, tests/orgs).
 *
 * Those suites skip unless both vars are set so `npm test` is clean on a machine
 * without local Supabase. Prefer a dedicated test project or `supabase start` —
 * do not point this at production.
 */
export const SUPABASE_TEST_SKIP_REASON =
  'Skipped: set SUPABASE_TEST_URL and SUPABASE_SERVICE_ROLE_KEY to run RLS/auth/org integration tests.'

export function hasSupabaseTestEnv(): boolean {
  return Boolean(
    process.env.SUPABASE_TEST_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  )
}

/** API URL for integration tests. Prefer SUPABASE_TEST_URL over the app public URL. */
export function supabaseTestUrl(): string | undefined {
  return (
    process.env.SUPABASE_TEST_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  )
}
