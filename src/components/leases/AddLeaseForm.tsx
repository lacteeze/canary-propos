'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { createLease } from '@/app/actions/leases'
import { validateLeaseDates } from '@/lib/canary/lease-term'
import type { LeaseTermType } from '@/lib/canary/lease-term'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const formSchema = z
  .object({
    tenant_id: z.string().min(1, 'Please select a tenant'),
    property_id: z.string().min(1, 'Please select a property'),
    unit_id: z.string().min(1, 'Please select a unit'),
    term_type: z.enum(['fixed_term', 'month_to_month']),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().optional().default(''),
    monthly_rent: z.coerce.number().positive('Monthly rent must be positive'),
    deposit_amount: z.coerce.number().min(0, 'Deposit must be 0 or greater'),
    rent_due_day: z.coerce.number().int().min(1).max(28),
  })
  .superRefine((data, ctx) => {
    const err = validateLeaseDates(data.term_type, data.start_date, data.end_date || null)
    if (err) ctx.addIssue({ code: 'custom', message: err, path: ['end_date'] })
  })

type FormValues = z.infer<typeof formSchema>

interface Tenant {
  id: string
  first_name: string | null
  last_name: string | null
}

interface Property {
  id: string
  street_address: string
  city: string
}

interface Unit {
  id: string
  unit_number: string | null
}

interface AddLeaseFormProps {
  tenants: Tenant[]
  properties: Property[]
  buttonLabel?: string
}

export function AddLeaseForm({ tenants, properties, buttonLabel = 'Add Lease' }: AddLeaseFormProps) {
  const [open, setOpen] = useState(false)
  const [units, setUnits] = useState<Unit[]>([])
  const [loadingUnits, setLoadingUnits] = useState(false)

  const form = useForm<FormValues, unknown, FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      tenant_id: '',
      property_id: '',
      unit_id: '',
      term_type: 'fixed_term' as LeaseTermType,
      start_date: '',
      end_date: '',
      monthly_rent: 0,
      deposit_amount: 0,
      rent_due_day: 1,
    },
  })

  const selectedPropertyId = form.watch('property_id')

  useEffect(() => {
    if (!selectedPropertyId) {
      setUnits([])
      form.setValue('unit_id', '')
      return
    }

    setLoadingUnits(true)
    form.setValue('unit_id', '')

    const supabase = createClient()
    supabase
      .from('units')
      .select('id, unit_number')
      .eq('property_id', selectedPropertyId)
      .eq('status', 'vacant')
      .then(({ data }) => {
        setUnits(data ?? [])
        setLoadingUnits(false)
      })
  }, [selectedPropertyId, form])

  async function onSubmit(values: FormValues) {
    const result = await createLease({
      unit_id: values.unit_id,
      tenant_id: values.tenant_id,
      term_type: values.term_type,
      start_date: values.start_date,
      end_date: values.end_date || null,
      monthly_rent: values.monthly_rent,
      deposit_amount: values.deposit_amount,
      rent_due_day: values.rent_due_day,
    })

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success('Lease created successfully.')
    form.reset()
    setUnits([])
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<span />} onClick={() => setOpen(true)}>
        <Button>{buttonLabel}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Lease</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Tenant select */}
            <FormField
              control={form.control}
              name="tenant_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tenant</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select tenant" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {tenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {[t.first_name, t.last_name].filter(Boolean).join(' ') || 'Unnamed'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Property select (triggers unit reload) */}
            <FormField
              control={form.control}
              name="property_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select property" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.street_address}, {p.city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Unit select (populated from useEffect) */}
            <FormField
              control={form.control}
              name="unit_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!selectedPropertyId || loadingUnits}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            !selectedPropertyId
                              ? 'Select a property first'
                              : loadingUnits
                              ? 'Loading units…'
                              : units.length === 0
                              ? 'No vacant units'
                              : 'Select unit'
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {units.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.unit_number ?? 'Unit (no number)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date range */}
            <FormField
              control={form.control}
              name="term_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Term type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="fixed_term">Fixed term</SelectItem>
                      <SelectItem value="month_to_month">Month-to-month</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      End Date{form.watch('term_type') === 'month_to_month' ? ' (optional)' : ''}
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Rent */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="monthly_rent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Rent ($)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={0.01} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deposit_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deposit ($)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={0.01} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Rent due day */}
            <FormField
              control={form.control}
              name="rent_due_day"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rent Due Day (1–28)</FormLabel>
                  <Select onValueChange={(v) => { if (v) field.onChange(parseInt(v)) }} value={String(field.value)}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'} of each month
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <p className="text-xs text-stone-500">
              You can upload the lease PDF after creating the lease from the lease detail page.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Creating…' : 'Create Lease'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
