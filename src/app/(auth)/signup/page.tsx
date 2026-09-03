'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { createClient } from '@/lib/supabase/client'
import { signUpSchema, type SignUpValues } from '@/lib/validation/auth'

export default function SignUpPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState<string | null>(null)

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: SignUpValues) {
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setIsLoading(false)
      const already =
        error.message.toLowerCase().includes('already') ||
        error.message.toLowerCase().includes('registered')
      setError(
        already
          ? 'An account with this email already exists. Sign in to continue.'
          : 'Something went wrong creating your account. Please try again.',
      )
      return
    }

    if (!data.session) {
      setIsLoading(false)
      setCheckEmail(values.email)
      return
    }

    router.push('/onboarding')
  }

  if (checkEmail) {
    return (
      <div className="auth-card">
        <p className="auth-kicker">Check your email</p>
        <h1 className="auth-title">Confirm your address</h1>
        <p className="auth-sub">
          Check your email — we sent a confirmation link to {checkEmail}. Open it to finish
          creating your workspace.
        </p>
        <Link href="/login" className="auth-link">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="auth-card">
      <p className="auth-kicker">Get started</p>
      <h1 className="auth-title">Create your account</h1>
      <p className="auth-sub">Start your free property management workspace.</p>

      <div className="space-y-5">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div role="alert" className="auth-alert auth-alert-error">
                {error}
              </div>
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <input
                      type="email"
                      className="auth-input"
                      placeholder="you@example.com"
                      autoFocus
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="auth-input pr-11"
                        placeholder="Min. 8 characters"
                        autoComplete="new-password"
                        {...field}
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        title={showPassword ? 'Hide password' : 'Show password'}
                        className="auth-eye"
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <Eye className="h-5 w-5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <button type="submit" disabled={isLoading} className="auth-btn">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Creating account...
                </>
              ) : (
                'Create your organization'
              )}
            </button>
          </form>
        </Form>

        <p className="auth-muted">
          Already have an account?{' '}
          <Link href="/login" className="auth-link">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
