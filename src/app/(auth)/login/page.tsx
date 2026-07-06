'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SignInForm } from '@/components/auth/SignInForm'
import { MagicLinkForm } from '@/components/auth/MagicLinkForm'
import { OAuthButtons } from '@/components/auth/OAuthButtons'

export default function LoginPage() {
  const [mode, setMode] = useState<'password' | 'magic-link'>('password')

  return (
    <div className="auth-card">
      <p className="auth-kicker">Welcome back</p>
      <h1 className="auth-title">Sign in to Canary PM</h1>
      <p className="auth-sub">Manage your properties, people, and payments.</p>

      <div className="space-y-5">
        {mode === 'password' ? (
          <SignInForm onSwitchToMagicLink={() => setMode('magic-link')} />
        ) : (
          <MagicLinkForm onSwitchToPassword={() => setMode('password')} />
        )}

        <div className="auth-divider">
          <span>Or</span>
        </div>

        <OAuthButtons />

        <p className="auth-muted">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="auth-link">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
