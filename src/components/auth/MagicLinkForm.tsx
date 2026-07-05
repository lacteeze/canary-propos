'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
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
        <div
          role="status"
          className="rounded-md border border-green-200 bg-green-50 p-4"
        >
          <p className="text-sm font-semibold text-green-800">Check your email</p>
          <p className="mt-0.5 text-sm text-green-700">
            We&apos;ve sent a sign-in link to <strong>{sentTo}</strong>.
          </p>
        </div>
        <button
          type="button"
          onClick={onSwitchToPassword}
          className="block w-full text-center text-sm"
          style={{ color: '#D97706' }}
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

        <Button
          type="submit"
          disabled={isLoading}
          className="min-h-11 w-full font-semibold"
          style={{ backgroundColor: '#D97706', color: '#ffffff' }}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Sending...
            </>
          ) : (
            'Send magic link'
          )}
        </Button>

        <button
          type="button"
          onClick={onSwitchToPassword}
          className="block w-full text-center text-sm"
          style={{ color: '#D97706' }}
        >
          Back to sign in with password
        </button>
      </form>
    </Form>
  )
}
