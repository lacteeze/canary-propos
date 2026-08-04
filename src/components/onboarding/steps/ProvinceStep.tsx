'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { CANADIAN_PROVINCES } from '@/lib/constants/provinces'

const provinceCodes = CANADIAN_PROVINCES.map((p) => p.value) as [string, ...string[]]

const provinceSchema = z.object({
  province: z.enum(provinceCodes, { error: 'Please select your province or territory' }),
})

type ProvinceValues = z.infer<typeof provinceSchema>

interface ProvinceStepProps {
  defaultValue?: string
  onNext: (province: string) => void | Promise<void>
  isLoading?: boolean
}

export function ProvinceStep({ defaultValue, onNext, isLoading }: ProvinceStepProps) {
  const form = useForm<ProvinceValues>({
    resolver: zodResolver(provinceSchema),
    defaultValues: { province: (defaultValue as ProvinceValues['province']) ?? undefined },
  })

  function onSubmit(values: ProvinceValues) {
    onNext(values.province)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1">
        <h2 className="onboard-title">Where do you operate?</h2>
        <p className="onboard-sub">Required for Canadian tenancy compliance rules.</p>

        <FormField
          control={form.control}
          name="province"
          render={({ field }) => (
            <FormItem className="onboard-field">
              <FormLabel className="auth-label">Province or Territory</FormLabel>
              <FormControl>
                <select
                  className="onboard-select"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                >
                  <option value="" disabled>
                    Select your province or territory
                  </option>
                  {CANADIAN_PROVINCES.map((province) => (
                    <option key={province.value} value={province.value}>
                      {province.label}
                    </option>
                  ))}
                </select>
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
