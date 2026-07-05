'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-[1.25rem] font-semibold leading-tight text-stone-900">
            Invite your first team member
          </h2>
          <p className="text-stone-500">
            They&apos;ll receive an email to join your organization as a manager.
          </p>
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email address</FormLabel>
              <FormControl>
                <Input
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

        <div className="space-y-2">
          <Button
            type="submit"
            disabled={isLoading}
            className="min-h-11 w-full font-semibold"
            style={{ backgroundColor: '#D97706', color: '#ffffff' }}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Sending invite...
              </>
            ) : (
              'Send invite & continue'
            )}
          </Button>

          <button
            type="button"
            onClick={onSkip}
            disabled={isLoading}
            className="block w-full text-center text-sm text-stone-500 underline-offset-4 hover:underline"
          >
            Skip for now
          </button>
        </div>
      </form>
    </Form>
  )
}
