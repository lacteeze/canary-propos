/**
 * Unauthenticated Supabase client for the (public) route group.
 * Uses the anon key only — no user session. Only executes queries
 * permitted by anon RLS policies.
 *
 * Always `cache: 'no-store'`: listing photo signing returns short-lived JWTs.
 * If Next.js Data Cache / Server Components HMR cache replays those responses,
 * carousel `<img>` tags keep expired signed URLs (HTTP 400).
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
      global: {
        fetch: (url, init) => fetch(url, { ...init, cache: 'no-store' }),
      },
    }
  )
}
