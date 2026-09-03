import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'

export const OAUTH_STATE_COOKIE = 'oauth_state'
const OAUTH_STATE_MAX_AGE = 10 * 60

export async function setOAuthStateCookie(state: string): Promise<void> {
  const store = await cookies()
  store.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: OAUTH_STATE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  })
}

export function clearOAuthStateCookie(response: NextResponse): void {
  response.cookies.set(OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  })
}
