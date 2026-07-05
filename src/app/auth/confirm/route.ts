import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

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
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (token_hash && type) {
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

    const { error } = await supabase.auth.verifyOtp({ token_hash, type })

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const role = user?.app_metadata?.role as string | undefined
      const redirectPath = ROLE_REDIRECT_MAP[role ?? ''] ?? '/dashboard'
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin  // CR-02 fix
      return NextResponse.redirect(new URL(redirectPath, appUrl))
    }
  }

  // Verification failed — redirect to error page
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin
  return NextResponse.redirect(new URL('/auth-code-error', appUrl))
}
