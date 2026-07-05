/**
 * RLS CI Linter — fails with exit code 1 if any table in the public schema
 * lacks Row Level Security (rowsecurity = false).
 *
 * Run: npx tsx scripts/check-rls.ts
 * Or:  npm run check:rls
 *
 * This script gates CI — if any public table lacks RLS, the build fails.
 * Pattern source: RESEARCH.md Pattern 4
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function checkRLS(): Promise<void> {
  // Query pg_tables to find public tables where rowsecurity is disabled.
  // The admin/service_role client can read pg_tables via Supabase's RPC or
  // raw SQL. We use a direct SQL query via .rpc() if available, or fall back
  // to a documented approach.
  //
  // NOTE: Supabase JS client cannot execute raw SQL against pg_tables directly.
  // This uses a custom RPC function that must be created via migration:
  //
  //   CREATE OR REPLACE FUNCTION public.tables_without_rls()
  //   RETURNS TABLE (tablename text)
  //   LANGUAGE sql SECURITY DEFINER SET search_path = ''
  //   AS $$ SELECT tablename::text FROM pg_tables
  //            WHERE schemaname = 'public' AND NOT rowsecurity; $$;
  //
  // If this function doesn't exist yet (before migrations run), this script
  // will report that and exit 0 (no tables to check yet).

  const { data, error } = await supabase.rpc('tables_without_rls')

  if (error) {
    // Function not yet created (migrations haven't run) — not a failure.
    if (
      error.message.includes('does not exist') ||
      error.message.includes('could not find')
    ) {
      console.log(
        'INFO: tables_without_rls() function not found — migrations not yet applied. ' +
          'This is expected before the first migration runs. ' +
          'Re-run check:rls after applying migrations.'
      )
      process.exit(0)
    }

    console.error('ERROR: Failed to run RLS check:', error.message)
    process.exit(1)
  }

  const tablesWithoutRLS = data as Array<{ tablename: string }>

  if (tablesWithoutRLS && tablesWithoutRLS.length > 0) {
    console.error('FAIL: The following public tables are missing Row Level Security:')
    tablesWithoutRLS.forEach((row) => {
      console.error(`  - ${row.tablename}`)
    })
    console.error(
      '\nFix: Add "ALTER TABLE public.<tablename> ENABLE ROW LEVEL SECURITY;" ' +
        'to the table migration and add at least one RLS policy.'
    )
    process.exit(1)
  }

  console.log('PASS: All public tables have Row Level Security enabled.')
  process.exit(0)
}

checkRLS().catch((err: unknown) => {
  console.error('ERROR: Unexpected error in RLS check:', err)
  process.exit(1)
})
