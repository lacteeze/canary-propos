import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'
import {
  AUTH_PERSIST_COOKIE,
  applyAuthCookieMaxAge,
  isAuthPersistEnabled,
} from '@/lib/supabase/auth-persist'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            const persist = isAuthPersistEnabled(
              cookieStore.get(AUTH_PERSIST_COOKIE)?.value,
            )
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, applyAuthCookieMaxAge(options, persist)),
            )
          } catch {
            // Server Component — cookie writes are handled by middleware.
            // This try/catch is expected; the error can be safely ignored.
          }
        },
      },
    },
  )
}
