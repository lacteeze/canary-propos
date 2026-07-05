/**
 * Unauthenticated Supabase client for the (public) route group.
 * Uses the anon key only — no user session. Only executes queries
 * permitted by anon RLS policies.
 */
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

export function createPublicClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  )
}
