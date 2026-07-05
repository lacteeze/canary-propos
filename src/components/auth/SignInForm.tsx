'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
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
import { signInSchema, type SignInValues } from '@/lib/validation/auth'

interface SignInFormProps {
  onSwitchToMagicLink: () => void
}

export function SignInForm({ onSwitchToMagicLink }: SignInFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorHeading, setErrorHeading] = useState<string | null>(null)
  const [errorBody, setErrorBody] = useState<string | null>(null)

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: SignInValues) {
    setIsLoading(true)
    setErrorHeading(null)
    setErrorBody(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (error) {
      setIsLoading(false)
      setErrorHeading("Couldn't sign you in")
      setErrorBody(
        'The email or password you entered doesn\'t match our records. Try again or send a magic link.'
      )
      return
    }

    // Redirect handled by middleware after successful sign-in
    window.location.href = '/'
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {errorHeading && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-3"
          >
            <p className="text-sm font-semibold text-red-800">{errorHeading}</p>
            <p className="mt-0.5 text-sm text-red-700">{errorBody}</p>
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
                    placeholder="••••••••"
                    autoComplete="current-password"
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
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </Button>

        <button
          type="button"
          onClick={onSwitchToMagicLink}
          className="block w-full text-center text-sm"
          style={{ color: '#D97706' }}
        >
          Send me a magic link
        </button>
      </form>
    </Form>
  )
}
