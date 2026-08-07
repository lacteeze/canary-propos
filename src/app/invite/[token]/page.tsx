// src/app/invite/[token]/page.tsx
// Invite acceptance — org join for tenants/team (not "create organization")
'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'
import { portalPathForRole } from '@/lib/auth/role-redirect'
import '@/components/canary/canary.css'

type InviteState =
  | { status: 'loading' }
  | { status: 'already_accepted' }
  | { status: 'not_found' }
  | {
      status: 'ready'
      email: string
      role: string
      orgName: string
      personId: string
      firstName: string
    }
  | { status: 'submitting' }
  | { status: 'check_email'; message: string }
  | { status: 'error'; message: string }

const ROLE_LABEL: Record<string, string> = {
  tenant: 'tenant',
  vendor: 'vendor',
  owner: 'owner',
  manager: 'team member',
  employee: 'team member',
  admin: 'admin',
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
        firstName: data.firstName ?? '',
      })
      if (data.firstName) setFirstName(data.firstName)
    }

    loadInvite()
  }, [token])

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (state.status !== 'ready') return

    setState({ status: 'submitting' })

    const supabase = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const emailRedirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback?invite_token=${encodeURIComponent(token)}`
        : undefined

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: state.email,
      password,
      options: {
        emailRedirectTo,
        data: {
          first_name: firstName,
          last_name: lastName,
          invite_token: token,
        },
      },
    })

    if (signUpError || !signUpData.user) {
      const already =
        signUpError?.message?.toLowerCase().includes('already') ||
        signUpError?.message?.toLowerCase().includes('registered')
      setState({
        status: 'error',
        message: already
          ? 'An account with this email already exists. Sign in below to join your portal.'
          : (signUpError?.message ?? 'Sign-up failed. Please try again.'),
      })
      return
    }

    if (!signUpData.session) {
      localStorage.setItem('pending_invite_token', token)
      setState({
        status: 'check_email',
        message:
          'Account created. Check your email to confirm your address — then you will land in your portal.',
      })
      return
    }

    const acceptRes = await fetch('/api/invites/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, firstName, lastName }),
    })

    if (!acceptRes.ok) {
      setState({
        status: 'error',
        message:
          'Account created but we could not link your invite. Please contact your property manager.',
      })
      return
    }

    const acceptData = (await acceptRes.json()) as { redirect?: string; role?: string }
    const redirect =
      acceptData.redirect ?? portalPathForRole(acceptData.role ?? state.role)
    router.replace(redirect)
  }

  const shell = (inner: ReactNode) => (
    <div className="cnry" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow)',
            padding: '32px 28px',
          }}
        >
          {inner}
        </div>
      </div>
    </div>
  )

  if (state.status === 'loading') {
    return shell(
      <p style={{ color: 'var(--dim)', margin: 0, textAlign: 'center' }}>Loading your invite…</p>,
    )
  }

  if (state.status === 'already_accepted') {
    return shell(
      <>
        <h1 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--text)' }}>
          Invite already used
        </h1>
        <p style={{ margin: '0 0 20px', color: 'var(--dim)', lineHeight: 1.5 }}>
          This invite was already accepted. Sign in to open your portal.
        </p>
        <a href="/login" className="cy-btn" style={{ display: 'block', textAlign: 'center' }}>
          Sign in
        </a>
      </>,
    )
  }

  if (state.status === 'not_found') {
    return shell(
      <>
        <h1 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--text)' }}>
          Invite expired
        </h1>
        <p style={{ margin: 0, color: 'var(--dim)', lineHeight: 1.5 }}>
          Ask your property manager to send a new invite.
        </p>
      </>,
    )
  }

  if (state.status === 'check_email') {
    return shell(
      <>
        <h1 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--text)' }}>
          Confirm your email
        </h1>
        <p style={{ margin: 0, color: 'var(--dim)', lineHeight: 1.5 }}>{state.message}</p>
      </>,
    )
  }

  if (state.status === 'error') {
    return shell(
      <>
        <h1 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--text)' }}>
          Almost there
        </h1>
        <p style={{ margin: '0 0 20px', color: 'var(--dim)', lineHeight: 1.5 }}>
          {state.message}
        </p>
        <a href="/login" className="cy-btn" style={{ display: 'block', textAlign: 'center' }}>
          Sign in
        </a>
      </>,
    )
  }

  const isSubmitting = state.status === 'submitting'
  const isTenant = state.status === 'ready' && state.role === 'tenant'
  const orgName = state.status === 'ready' ? state.orgName : ''
  const roleLabel =
    state.status === 'ready' ? (ROLE_LABEL[state.role] ?? state.role) : ''

  return shell(
    <>
      <p
        style={{
          margin: '0 0 6px',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
        }}
      >
        {isTenant ? 'Tenant portal' : 'Portal invite'}
      </p>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--text)' }}>
        {isTenant ? `Join ${orgName || 'your home'}` : `Join ${orgName || 'the team'}`}
      </h1>
      <p style={{ margin: '0 0 24px', color: 'var(--dim)', lineHeight: 1.5 }}>
        {isTenant
          ? 'Set a password to access your lease, rent payments, and maintenance updates. You are joining an existing property — not creating a new organization.'
          : `Create your account to get started as a ${roleLabel}.`}
      </p>

      {state.status === 'ready' && (
        <form onSubmit={handleSignUp} style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              Email address
            </span>
            <input
              type="email"
              value={state.email}
              readOnly
              className="cy-input"
              style={{ background: 'var(--elev)', color: 'var(--dim)' }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              First name
            </span>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              placeholder="Your first name"
              className="cy-input"
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              Last name
            </span>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              placeholder="Your last name"
              className="cy-input"
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              Create a password
            </span>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="cy-input"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 0,
                  background: 'transparent',
                  color: 'var(--faint)',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          <button type="submit" disabled={isSubmitting} className="cy-btn" style={{ marginTop: 4 }}>
            {isSubmitting
              ? 'Creating account…'
              : isTenant
                ? 'Join tenant portal'
                : 'Create my account'}
          </button>

          <p style={{ margin: 0, textAlign: 'center', fontSize: 13, color: 'var(--dim)' }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              Sign in
            </a>
          </p>
        </form>
      )}
    </>,
  )
}
