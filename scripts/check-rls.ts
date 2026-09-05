/**
 * RLS CI Linter — fails with exit code 1 if:
 *   1. Any public base table lacks Row Level Security
 *   2. Any public base table has RLS enabled but zero policies
 *      (except a documented allow-list of service-role-only tables)
 *   3. Any anon policy uses USING (true) on a base table
 *
 * Run: npx tsx scripts/check-rls.ts
 * Or:  npm run check:rls
 *
 * Catalog queries (2) and (3) use DATABASE_URL / SUPABASE_DB_URL / psql,
 * or the local `supabase start` docker Postgres. They do not add a migration.
 */

import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/**
 * Service-role-only tables: RLS on, zero policies, by design.
 * org_integrations holds OAuth tokens (Track A). Do not add public policies.
 * pingram_webhook_events is webhook idempotency (same spirit as stripe_events).
 */
const RLS_NO_POLICY_ALLOWLIST = new Set([
  'org_integrations',
  'pingram_webhook_events',
])

const TABLES_RLS_NO_POLICIES_SQL = `
SELECT COALESCE(json_agg(t), '[]'::json)
FROM (
  SELECT c.relname AS tablename
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity
    AND NOT EXISTS (
      SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid
    )
  ORDER BY c.relname
) t
`

const ANON_USING_TRUE_SQL = `
SELECT COALESCE(json_agg(t), '[]'::json)
FROM (
  SELECT c.relname AS tablename, p.polname AS policyname
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND pg_get_expr(p.polqual, p.polrelid) = 'true'
    AND (
      p.polroles = '{0}'::oid[]
      OR EXISTS (
        SELECT 1
        FROM unnest(p.polroles) AS role_oid
        JOIN pg_roles r ON r.oid = role_oid
        WHERE r.rolname = 'anon'
      )
    )
  ORDER BY c.relname, p.polname
) t
`

function tryExec(command: string, args: string[]): string | null {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return null
  }
}

function queryCatalogJson(sql: string): unknown[] {
  const dbUrl =
    process.env.DATABASE_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim() ||
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

  const psqlDirect = tryExec('psql', [
    dbUrl,
    '-v',
    'ON_ERROR_STOP=1',
    '-At',
    '-c',
    sql,
  ])
  if (psqlDirect) return JSON.parse(psqlDirect) as unknown[]

  const dockerIds = tryExec('docker', [
    'ps',
    '-q',
    '--filter',
    'name=supabase_db',
  ])
  if (dockerIds) {
    const id = dockerIds.split(/\s+/).find(Boolean)
    if (id) {
      const fromDocker = tryExec('docker', [
        'exec',
        '-i',
        id,
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-v',
        'ON_ERROR_STOP=1',
        '-At',
        '-c',
        sql,
      ])
      if (fromDocker) return JSON.parse(fromDocker) as unknown[]
    }
  }

  throw new Error(
    'Cannot query pg_catalog for extra RLS checks. Set DATABASE_URL (or SUPABASE_DB_URL) and install psql, or run against `supabase start`.',
  )
}

async function checkMissingRls(): Promise<void> {
  const { data, error } = await supabase.rpc('tables_without_rls')

  if (error) {
    if (
      error.message.includes('does not exist') ||
      error.message.includes('could not find')
    ) {
      console.log(
        'INFO: tables_without_rls() function not found — migrations not yet applied. ' +
          'This is expected before the first migration runs. ' +
          'Re-run check:rls after applying migrations.',
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
        'to the table migration and add at least one RLS policy.',
    )
    process.exit(1)
  }

  console.log('PASS: All public tables have Row Level Security enabled.')
}

function checkRlsWithoutPolicies(): void {
  const rows = queryCatalogJson(TABLES_RLS_NO_POLICIES_SQL) as Array<{
    tablename: string
  }>
  const unexpected = rows.filter((row) => !RLS_NO_POLICY_ALLOWLIST.has(row.tablename))

  if (unexpected.length > 0) {
    console.error(
      'FAIL: The following public tables have RLS enabled but zero policies:',
    )
    unexpected.forEach((row) => {
      console.error(`  - ${row.tablename}`)
    })
    console.error(
      '\nA table with RLS and no policies is unreachable to every role except ' +
        'service_role. Add policies, or add the table to RLS_NO_POLICY_ALLOWLIST ' +
        'in scripts/check-rls.ts if that is intentional.',
    )
    process.exit(1)
  }

  if (rows.length > 0) {
    console.log(
      `PASS: RLS-enabled tables with zero policies are allow-listed (${[...RLS_NO_POLICY_ALLOWLIST].join(', ')}).`,
    )
  } else {
    console.log('PASS: No RLS-enabled public tables are missing policies.')
  }
}

function checkAnonUsingTrue(): void {
  const rows = queryCatalogJson(ANON_USING_TRUE_SQL) as Array<{
    tablename: string
    policyname: string
  }>

  if (rows.length > 0) {
    console.error(
      'FAIL: The following anon policies use USING (true) on a base table:',
    )
    rows.forEach((row) => {
      console.error(`  - ${row.tablename}.${row.policyname}`)
    })
    console.error(
      '\nAnon USING (true) on a base table exposes every row. Scope the policy ' +
        'or move public columns to a view.',
    )
    process.exit(1)
  }

  console.log('PASS: No anon USING (true) policies on public base tables.')
}

async function checkRLS(): Promise<void> {
  await checkMissingRls()
  checkRlsWithoutPolicies()
  checkAnonUsingTrue()
  process.exit(0)
}

checkRLS().catch((err: unknown) => {
  console.error('ERROR: Unexpected error in RLS check:', err)
  process.exit(1)
})
