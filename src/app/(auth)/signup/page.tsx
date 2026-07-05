'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: SignUpValues) {
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setIsLoading(false)
      setError('Something went wrong creating your account. Please try again.')
      return
    }

    // After sign-up, redirect to onboarding wizard (D-03: same flow for everyone)
    router.push('/onboarding')
  }

  return (
    <Card className="w-full max-w-[400px] shadow-sm">
      <CardHeader className="pb-4 text-center">
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
          Create your account
        </h1>
        <p className="text-sm text-stone-500">
          Start your free property management workspace.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 p-3"
              >
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
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
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
                        autoComplete="new-password"
                        className="pr-10"
                        {...field}
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        title={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-stone-400 hover:text-stone-600"
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

            <Button
              type="submit"
              disabled={isLoading}
              className="min-h-11 w-full font-semibold"
              style={{ backgroundColor: '#D97706', color: '#ffffff' }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Creating account...
                </>
              ) : (
                'Create your organization'
              )}
            </Button>
          </form>
        </Form>

        <p className="text-center text-sm text-stone-500">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium underline-offset-4 hover:underline"
            style={{ color: '#D97706' }}
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
