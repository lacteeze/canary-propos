import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Role-based redirect map (D-04)
const ROLE_REDIRECT_MAP: Record<string, string> = {
  manager: '/dashboard',
  employee: '/dashboard',
  admin: '/admin',
  tenant: '/my-home',
  owner: '/portfolio',
  vendor: '/jobs',
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // JWT claims now set by Auth Hook — read role from app_metadata
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const role = user?.app_metadata?.role as string | undefined
      const redirectPath = ROLE_REDIRECT_MAP[role ?? ''] ?? '/dashboard'
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin  // CR-02 fix: anchor to known origin
      return NextResponse.redirect(new URL(redirectPath, appUrl))
    }
  }

  // Exchange failed or no code — redirect to error page
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin
  return NextResponse.redirect(new URL('/auth-code-error', appUrl))
}
