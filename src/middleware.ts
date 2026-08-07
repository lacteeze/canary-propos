// src/middleware.ts
// Session refresh + role-based routing for all portals
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  AUTH_PERSIST_COOKIE,
  applyAuthCookieMaxAge,
  isAuthPersistEnabled,
} from '@/lib/supabase/auth-persist'
import { ensureJwtClaimsFromPeople } from '@/lib/auth/sync-jwt-claims'
import { portalPathForRole } from '@/lib/auth/role-redirect'

function isPublicListingsPath(pathname: string): boolean {
  return pathname.startsWith('/listings')
}

function isMaintenanceNoLoginPath(pathname: string): boolean {
  return (
    pathname.startsWith('/vendor/jobs') ||
    pathname.startsWith('/owner/approve') ||
    pathname.startsWith('/owner/decline')
  )
}

function extractOrgSlug(request: NextRequest): string {
  const hostname = request.headers.get('host') ?? ''
  const parts = hostname.split('.')
  const subdomain = parts.length >= 3 ? parts[0] : null

  // Vercel preview/production default hostnames are not tenant subdomains
  if (hostname.endsWith('.vercel.app')) {
    return request.nextUrl.searchParams.get('org') ?? ''
  }

  if (!subdomain || subdomain === 'localhost' || subdomain === 'www' || subdomain === 'app') {
    // Localhost / no-subdomain fallback: read ?org= query param
    return request.nextUrl.searchParams.get('org') ?? ''
  }
  return subdomain
}

function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith('/app') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/my-home') ||
    pathname.startsWith('/receipts') ||
    pathname.startsWith('/portfolio') ||
    pathname.startsWith('/jobs') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/onboarding') ||  // CR-04: protect onboarding from unauthed access
    pathname.startsWith('/people') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/inquiries')
  )
}

/** Preserve session cookies set during refreshSession onto redirect responses. */
function redirectWithSession(
  url: URL,
  sessionResponse: NextResponse,
): NextResponse {
  const redirect = NextResponse.redirect(url)
  sessionResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie.name, cookie.value)
  })
  return redirect
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // No-login maintenance routes (vendor jobs, owner approve/decline) — token is the credential
  if (isMaintenanceNoLoginPath(pathname)) {
    return NextResponse.next({ request })
  }

  const isListings = isPublicListingsPath(pathname)
  const requestHeaders = new Headers(request.headers)
  // Org slug for public listing detail (UUID + root SEO /{slug}) and other pages that read the header
  requestHeaders.set('x-org-slug', extractOrgSlug(request))

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const persist = isAuthPersistEnabled(
    request.cookies.get(AUTH_PERSIST_COOKIE)?.value,
  )

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(
              name,
              value,
              applyAuthCookieMaxAge(options, persist),
            )
          )
        },
      },
    }
  )

  // CRITICAL: getUser() refreshes the session on every request — do not remove or replace with getSession()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // /listings/* is public — session was refreshed above; skip auth redirects.
  // Root /{slug} is also public: it is not isProtectedPath, so unauth users are not redirected.
  if (isListings) {
    return supabaseResponse
  }

  // After onboarding / invite accept, JWT may lack org_id/role even though a
  // people row exists (or email can be linked). Sync claims + refresh for portals.
  if (
    user &&
    (pathname.startsWith('/app') ||
      pathname.startsWith('/onboarding') ||
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/my-home') ||
      pathname.startsWith('/receipts'))
  ) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      await ensureJwtClaimsFromPeople(supabase, user, session?.access_token)
    } catch (err) {
      console.error('[middleware] JWT claim sync failed', err)
    }
  }

  const {
    data: { user: freshUser },
  } = user
    ? await supabase.auth.getUser()
    : { data: { user: null } }
  const activeUser = freshUser ?? user
  const role = activeUser?.app_metadata?.role as string | undefined

  // Unauthenticated user accessing a protected path → redirect to /login
  if (!activeUser && isProtectedPath(pathname)) {
    return redirectWithSession(new URL('/login', request.url), supabaseResponse)
  }

  // Completed onboarding but still on /onboarding → role-appropriate portal
  if (activeUser && pathname.startsWith('/onboarding') && role && activeUser.app_metadata?.org_id) {
    return redirectWithSession(
      new URL(portalPathForRole(role), request.url),
      supabaseResponse,
    )
  }

  // Tenants use the dedicated /my-home portal — not CanaryApp staff chrome.
  // (Managers can still preview Tenant mode inside CanaryApp via role switcher.)
  if (
    activeUser &&
    role === 'tenant' &&
    (pathname === '/app' || pathname.startsWith('/app/'))
  ) {
    return redirectWithSession(new URL('/my-home', request.url), supabaseResponse)
  }

  // Legacy ManagerShell list URLs → CanaryApp (exact paths only; detail routes stay)
  const legacyListRedirects: Record<string, string> = {
    '/dashboard': '/app',
    '/properties': '/app?view=properties',
    '/leases': '/app?view=leases',
    '/payments': '/app?view=payments',
    '/people': '/app?view=people',
    '/maintenance': '/app?view=projects',
    '/billing': '/app?view=billing',
  }
  if (activeUser && legacyListRedirects[pathname]) {
    return redirectWithSession(
      new URL(legacyListRedirects[pathname], request.url),
      supabaseResponse,
    )
  }

  // Role guards per portal (D-04)
  // /dashboard — manager, employee, admin only
  if (
    pathname.startsWith('/dashboard') &&
    !['manager', 'employee', 'admin'].includes(role ?? '')
  ) {
    return redirectWithSession(new URL('/login', request.url), supabaseResponse)
  }

  // /my-home + /receipts — tenant only
  if (
    (pathname.startsWith('/my-home') || pathname.startsWith('/receipts')) &&
    role !== 'tenant'
  ) {
    const fallback = portalPathForRole(role)
    return redirectWithSession(
      new URL(role ? fallback : '/login', request.url),
      supabaseResponse,
    )
  }

  // /portfolio — owner only
  if (pathname.startsWith('/portfolio') && role !== 'owner') {
    return redirectWithSession(new URL('/login', request.url), supabaseResponse)
  }

  // /jobs — legacy vendor shell; send vendors into CanaryApp Projects
  if (pathname.startsWith('/jobs')) {
    if (role !== 'vendor') {
      return redirectWithSession(new URL('/login', request.url), supabaseResponse)
    }
    return redirectWithSession(
      new URL('/app?view=projects', request.url),
      supabaseResponse,
    )
  }

  // /admin — admin only (first layer; (admin)/layout.tsx adds independent server-side check per Pitfall 6)
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return redirectWithSession(new URL('/login', request.url), supabaseResponse)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
