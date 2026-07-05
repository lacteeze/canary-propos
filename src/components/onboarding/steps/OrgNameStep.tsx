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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-[1.25rem] font-semibold leading-tight text-stone-900">
            What&apos;s your company called?
          </h2>
          <p className="text-stone-500">
            This is how your organization will appear to managers, tenants, and owners.
          </p>
        </div>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Canary Property Management"
                  autoFocus
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
              Saving...
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </form>
    </Form>
  )
}
