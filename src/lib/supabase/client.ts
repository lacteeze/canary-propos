import {
  createBrowserClient,
  parseCookieHeader,
  serializeCookieHeader,
} from '@supabase/ssr'
import type { Database } from '@/types/supabase'
import {
  applyAuthCookieMaxAge,
  readAuthPersistPreference,
} from '@/lib/supabase/auth-persist'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          if (typeof document === 'undefined') return []
          return parseCookieHeader(document.cookie).map(({ name, value }) => ({
            name,
            value: value ?? '',
          }))
        },
        setAll(cookiesToSet) {
          if (typeof document === 'undefined') return
          // Read preference on each write so checkbox changes apply immediately
          // even when createBrowserClient is a singleton.
          const persist = readAuthPersistPreference()
          cookiesToSet.forEach(({ name, value, options }) => {
            document.cookie = serializeCookieHeader(
              name,
              value,
              applyAuthCookieMaxAge(options, persist),
            )
          })
        },
      },
    },
  )
}
