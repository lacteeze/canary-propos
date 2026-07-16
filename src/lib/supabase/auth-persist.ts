/**
 * "Keep me signed in" preference for auth cookie lifetime.
 *
 * @supabase/ssr always writes auth cookies with maxAge ≈ 400 days. We override
 * that in setAll (browser + middleware + server) when the user opts out, so
 * session cookies expire when the browser closes.
 */

export const AUTH_PERSIST_COOKIE = 'canary-auth-persist'
export const AUTH_PERSIST_STORAGE_KEY = 'canary-auth-persist'

/** Matches @supabase/ssr DEFAULT_COOKIE_OPTIONS.maxAge */
export const AUTH_COOKIE_PERSISTENT_MAX_AGE = 400 * 24 * 60 * 60

type CookieOptionsLike = {
  maxAge?: number
  expires?: Date
  [key: string]: unknown
}

/** Missing / unknown preference defaults to persistent (existing sessions keep working). */
export function isAuthPersistEnabled(raw: string | undefined | null): boolean {
  return raw !== '0'
}

/**
 * Apply remember-me lifetime to cookie options from @supabase/ssr.
 * Persist on → 400-day maxAge; off → omit maxAge/expires (session cookie).
 */
export function applyAuthCookieMaxAge<T extends CookieOptionsLike>(
  options: T | undefined,
  persist: boolean,
): T {
  const next = { ...(options ?? {}) } as T
  if (persist) {
    ;(next as CookieOptionsLike).maxAge = AUTH_COOKIE_PERSISTENT_MAX_AGE
  } else {
    delete (next as CookieOptionsLike).maxAge
    delete (next as CookieOptionsLike).expires
  }
  return next
}

/** Browser: cookie first, then localStorage, default true. */
export function readAuthPersistPreference(): boolean {
  if (typeof document !== 'undefined') {
    const match = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${AUTH_PERSIST_COOKIE}=`))
    if (match) {
      return isAuthPersistEnabled(match.slice(AUTH_PERSIST_COOKIE.length + 1))
    }
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(AUTH_PERSIST_STORAGE_KEY)
      if (stored !== null) return isAuthPersistEnabled(stored)
    }
  } catch {
    // private mode / blocked storage
  }
  return true
}

/** Call before signIn so auth cookies are written with the chosen lifetime. */
export function setAuthPersistPreference(remember: boolean): void {
  const value = remember ? '1' : '0'
  try {
    localStorage.setItem(AUTH_PERSIST_STORAGE_KEY, value)
  } catch {
    // ignore
  }
  if (typeof document === 'undefined') return
  // Preference cookie itself stays persistent so the choice survives reloads
  document.cookie = [
    `${AUTH_PERSIST_COOKIE}=${value}`,
    'path=/',
    `max-age=${AUTH_COOKIE_PERSISTENT_MAX_AGE}`,
    'SameSite=Lax',
  ].join('; ')
}
