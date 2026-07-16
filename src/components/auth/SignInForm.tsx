'use client'

import { useState } from 'react'
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
import { setAuthPersistPreference } from '@/lib/supabase/auth-persist'
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
    defaultValues: { email: '', password: '', rememberMe: true },
  })

  async function onSubmit(values: SignInValues) {
    setIsLoading(true)
    setErrorHeading(null)
    setErrorBody(null)

    // Set preference before sign-in so auth cookies get the right lifetime
    setAuthPersistPreference(values.rememberMe)

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

    // Signed in — land in the CanaryApp portal (middleware enforces role access)
    window.location.href = '/app'
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {errorHeading && (
          <div role="alert" className="auth-alert auth-alert-error">
            <span className="auth-alert-heading">{errorHeading}</span>
            {errorBody}
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
                    placeholder="••••••••"
                    autoComplete="current-password"
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

        <FormField
          control={form.control}
          name="rememberMe"
          render={({ field }) => (
            <FormItem>
              <label className="auth-remember">
                <input
                  type="checkbox"
                  className="auth-checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
                <span className="auth-remember-label">Keep me signed in</span>
              </label>
            </FormItem>
          )}
        />

        <button type="submit" disabled={isLoading} className="auth-btn">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </button>

        <button
          type="button"
          onClick={onSwitchToMagicLink}
          className="auth-link block w-full text-center"
        >
          Send me a magic link
        </button>
      </form>
    </Form>
  )
}
