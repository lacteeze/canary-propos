// src/app/invite/[token]/page.tsx
// Invite acceptance page — validates invite_token, pre-associates org + role (ORGS-02, D-08)
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

type InviteState =
  | { status: 'loading' }
  | { status: 'already_accepted' }
  | { status: 'not_found' }
  | { status: 'ready'; email: string; role: string; orgName: string; personId: string }
  | { status: 'submitting' }
  | { status: 'error'; message: string }

// All roles land in the CanaryApp portal — role scoping happens inside /app
const ROLE_REDIRECT: Record<string, string> = {
  manager: '/app',
  employee: '/app',
  tenant: '/app',
  owner: '/app',
  vendor: '/app',
  admin: '/app',
}

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [state, setState] = useState<InviteState>({ status: 'loading' })
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  useEffect(() => {
    async function loadInvite() {
      const res = await fetch(`/api/invites?token=${encodeURIComponent(token)}`)
      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'already_accepted') {
          setState({ status: 'already_accepted' })
        } else {
          setState({ status: 'not_found' })
        }
        return
      }

      setState({
        status: 'ready',
        email: data.email,
        role: data.role,
        orgName: data.orgName,
        personId: data.personId,
      })
    }

    loadInvite()
  }, [token])

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (state.status !== 'ready') return

    setState({ status: 'submitting' })

    const supabase = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Create the account
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: state.email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    })

    if (signUpError || !signUpData.user) {
      setState({
        status: 'error',
        message: signUpError?.message ?? 'Sign-up failed. Please try again.',
      })
      return
    }

    // CR-06 fix: if email confirmation is required, session is null — show "check email" state.
    // The invite will be linked in /auth/callback after email confirmation.
    // We store the pending token in localStorage so the callback can complete linkage.
    if (!signUpData.session) {
      // Store token for post-confirmation pickup in /auth/callback
      localStorage.setItem('pending_invite_token', token)
      setState({
        status: 'error',
        message: 'Account created! Check your email to confirm your address, then click the link to finish joining the team.',
      })
      return
    }

    // Confirmation not required (e.g. dev mode) — link immediately via authenticated route
    const acceptRes = await fetch('/api/invites/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, firstName, lastName }),
    })

    if (!acceptRes.ok) {
      setState({
        status: 'error',
        message: 'Account created but we could not link your invite. Please contact support.',
      })
      return
    }

    // Redirect to role-appropriate portal (D-08)
    const redirect = ROLE_REDIRECT[state.role] ?? '/app'
    router.replace(redirect)
  }

  // --- Render states ---

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="text-stone-600">Loading your invite...</p>
      </div>
    )
  }

  if (state.status === 'already_accepted') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-xl font-semibold text-stone-900">
            This invite has already been accepted
          </h1>
          <p className="text-stone-600">
            If you already have an account, sign in at{' '}
            <a href="/login" className="text-amber-600 underline">
              app.canarypm.ca/login
            </a>
            .
          </p>
        </div>
      </div>
    )
  }

  if (state.status === 'not_found') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-xl font-semibold text-stone-900">
            This invite has expired
          </h1>
          <p className="text-stone-600">
            Ask your property manager to send a new invite.
          </p>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-xl font-semibold text-stone-900">
            Something went wrong
          </h1>
          <p className="mb-6 text-stone-600">{state.message}</p>
          <a href="/login" className="text-amber-600 underline">
            Back to sign in
          </a>
        </div>
      </div>
    )
  }

  const isSubmitting = state.status === 'submitting'

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        {/* Header */}
        <h1 className="mb-1 text-2xl font-semibold text-stone-900">
          {state.status === 'ready' ? `Join ${state.orgName}` : 'Loading...'}
        </h1>
        {state.status === 'ready' && (
          <p className="mb-6 text-stone-600">
            Create your account to get started as a{' '}
            <span className="font-medium">{state.role}</span>.
          </p>
        )}

        {state.status === 'ready' && (
          <form onSubmit={handleSignUp} className="space-y-4">
            {/* Email (pre-filled, read-only) */}
            <div>
              <label htmlFor="invite-email" className="mb-1 block text-sm font-medium text-stone-700">
                Email address
              </label>
              <input
                id="invite-email"
                type="email"
                value={state.email}
                readOnly
                className="w-full rounded-md border border-stone-200 bg-stone-100 px-3 py-2 text-stone-600 focus:outline-none"
              />
            </div>

            {/* First name */}
            <div>
              <label htmlFor="invite-first-name" className="mb-1 block text-sm font-medium text-stone-700">
                First name
              </label>
              <input
                id="invite-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                placeholder="Your first name"
                className="w-full rounded-md border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>

            {/* Last name */}
            <div>
              <label htmlFor="invite-last-name" className="mb-1 block text-sm font-medium text-stone-700">
                Last name
              </label>
              <input
                id="invite-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                placeholder="Your last name"
                className="w-full rounded-md border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="invite-password" className="mb-1 block text-sm font-medium text-stone-700">
                Create a password
              </label>
              <div className="relative">
                <input
                  id="invite-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex min-h-11 w-full items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-white font-semibold hover:bg-amber-700 disabled:opacity-60"
            >
              {isSubmitting ? 'Creating account...' : 'Create my account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
