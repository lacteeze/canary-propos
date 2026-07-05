'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { SignInForm } from '@/components/auth/SignInForm'
import { MagicLinkForm } from '@/components/auth/MagicLinkForm'
import { OAuthButtons } from '@/components/auth/OAuthButtons'

export default function LoginPage() {
  const [mode, setMode] = useState<'password' | 'magic-link'>('password')

  return (
    <Card className="w-full max-w-[400px] shadow-sm">
      <CardHeader className="pb-4 text-center">
        {/* Canary wordmark */}
        <div className="mx-auto mb-2 flex items-center gap-1.5">
          <span className="text-xl font-semibold" style={{ color: '#D97706' }}>
            Canary
          </span>
          <span className="text-xl font-semibold text-stone-700">PropOS</span>
        </div>
        <h1
          className="text-[1.75rem] font-semibold leading-tight text-stone-900"
          style={{ lineHeight: '1.2' }}
        >
          Sign in to Canary PropOS
        </h1>
      </CardHeader>

      <CardContent className="space-y-5">
        {mode === 'password' ? (
          <SignInForm onSwitchToMagicLink={() => setMode('magic-link')} />
        ) : (
          <MagicLinkForm onSwitchToPassword={() => setMode('password')} />
        )}

        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-sm text-stone-500">
            Or
          </span>
        </div>

        <OAuthButtons />

        <p className="text-center text-sm text-stone-500">
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="font-medium underline-offset-4 hover:underline"
            style={{ color: '#D97706' }}
          >
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
