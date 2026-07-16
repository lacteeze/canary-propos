'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
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
import { magicLinkSchema, type MagicLinkValues } from '@/lib/validation/auth'

interface MagicLinkFormProps {
  onSwitchToPassword: () => void
}

export function MagicLinkForm({ onSwitchToPassword }: MagicLinkFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<MagicLinkValues>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: MagicLinkValues) {
    setIsLoading(true)
    setError(null)

    setAuthPersistPreference(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setIsLoading(false)

    if (error) {
      setError('Something went wrong sending the link. Check your connection and try again.')
      return
    }

    setSentTo(values.email)
  }

  if (sentTo) {
    return (
      <div className="space-y-4">
        <div role="status" className="auth-alert auth-alert-success">
          <span className="auth-alert-heading">Check your email</span>
          We&apos;ve sent a sign-in link to <strong>{sentTo}</strong>.
        </div>
        <button
          type="button"
          onClick={onSwitchToPassword}
          className="auth-link block w-full text-center"
        >
          Back to sign in with password
        </button>
      </div>
    )
  }

  return (
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

        <button type="submit" disabled={isLoading} className="auth-btn">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Sending...
            </>
          ) : (
            'Send magic link'
          )}
        </button>

        <button
          type="button"
          onClick={onSwitchToPassword}
          className="auth-link block w-full text-center"
        >
          Back to sign in with password
        </button>
      </form>
    </Form>
  )
}
