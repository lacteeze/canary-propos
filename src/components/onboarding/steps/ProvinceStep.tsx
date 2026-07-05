'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
    defaultValues: { province: defaultValue ?? '' },
  })

  function onSubmit(values: ProvinceValues) {
    onNext(values.province)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-[1.25rem] font-semibold leading-tight text-stone-900">
            Where do you operate?
          </h2>
          <p className="text-stone-500">
            Required for Canadian tenancy compliance rules.
          </p>
        </div>

        <FormField
          control={form.control}
          name="province"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Province or Territory</FormLabel>
              <FormControl>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <SelectTrigger className="min-h-11 w-full">
                    <SelectValue placeholder="Select your province or territory" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANADIAN_PROVINCES.map((province) => (
                      <SelectItem key={province.value} value={province.value}>
                        {province.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
