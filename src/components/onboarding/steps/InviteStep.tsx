'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const inviteSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .optional()
    .or(z.literal('')),
})

type InviteValues = z.infer<typeof inviteSchema>

interface InviteStepProps {
  onNext: (email: string | null) => void | Promise<void>
  onSkip: () => void
  isLoading?: boolean
}

export function InviteStep({ onNext, onSkip, isLoading }: InviteStepProps) {
  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '' },
  })

  function onSubmit(values: InviteValues) {
    const email = values.email?.trim() || null
    onNext(email)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1">
        <h2 className="onboard-title">Invite your first team member</h2>
        <p className="onboard-sub">
          They&apos;ll receive an email to join your organization as a manager.
        </p>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="onboard-field">
              <FormLabel className="auth-label">Email address</FormLabel>
              <FormControl>
                <Input
                  className="auth-input"
                  type="email"
                  placeholder="colleague@yourcompany.com"
                  autoFocus
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="onboard-actions">
          <button type="submit" disabled={isLoading} className="auth-btn">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Creating workspace...
              </>
            ) : (
              'Send invite & continue'
            )}
          </button>

          <button type="button" onClick={onSkip} disabled={isLoading} className="onboard-skip">
            Skip for now
          </button>
        </div>
      </form>
    </Form>
  )
}
