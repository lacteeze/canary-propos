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

const orgNameSchema = z.object({
  name: z
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(80, 'Organization name must be 80 characters or fewer'),
})

type OrgNameValues = z.infer<typeof orgNameSchema>

interface OrgNameStepProps {
  defaultValue?: string
  onNext: (name: string) => void | Promise<void>
  isLoading?: boolean
}

export function OrgNameStep({ defaultValue = '', onNext, isLoading }: OrgNameStepProps) {
  const form = useForm<OrgNameValues>({
    resolver: zodResolver(orgNameSchema),
    defaultValues: { name: defaultValue },
  })

  function onSubmit(values: OrgNameValues) {
    onNext(values.name)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1">
        <h2 className="onboard-title">What&apos;s your company called?</h2>
        <p className="onboard-sub">
          This is how your organization will appear to managers, tenants, and owners.
        </p>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="onboard-field">
              <FormLabel className="auth-label">Organization name</FormLabel>
              <FormControl>
                <Input
                  className="auth-input"
                  placeholder="e.g. Harbourview Holdings"
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
                Saving...
              </>
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </form>
    </Form>
  )
}
