'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { recordExpense } from '@/app/(manager)/payments/actions'
import {
  computeExpenseBilling,
  DEFAULT_EXPENSE_RATES,
} from '@/lib/billing/expense-breakdown'
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

const formSchema = z.object({
  property_id: z.string().uuid('Please select a property'),
  description: z.string().min(1, 'Description is required'),
  supplies_cost: z.coerce.number().min(0, 'Supplies cost must be 0 or more'),
  labour_hours: z.coerce.number().min(0, 'Hours must be 0 or more'),
  expense_date: z.string().min(1, 'Expense date is required'),
  staff_notes: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface PropertyOption {
  id: string
  address: string
}

interface RecordExpenseDialogProps {
  properties: PropertyOption[]
  onSuccess?: () => void
}

function formatCAD(n: number): string {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })
}

export function RecordExpenseDialog({ properties, onSuccess }: RecordExpenseDialogProps) {
  const [open, setOpen] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const form = useForm<FormValues, unknown, FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      property_id: '',
      description: '',
      supplies_cost: 0,
      labour_hours: 0,
      expense_date: today,
      staff_notes: '',
    },
  })

  const suppliesCost = form.watch('supplies_cost')
  const labourHours = form.watch('labour_hours')
  const preview = useMemo(
    () =>
      computeExpenseBilling({
        suppliesCost: Number(suppliesCost) || 0,
        labourHours: Number(labourHours) || 0,
        rates: DEFAULT_EXPENSE_RATES,
      }),
    [suppliesCost, labourHours]
  )

  async function onSubmit(values: FormValues) {
    const result = await recordExpense(values)
    if (result.success) {
      toast.success('Expense recorded successfully.')
      form.reset({
        property_id: '',
        description: '',
        supplies_cost: 0,
        labour_hours: 0,
        expense_date: today,
        staff_notes: '',
      })
      setOpen(false)
      onSuccess?.()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<span />} onClick={() => setOpen(true)}>
        <Button variant="outline">Record Expense</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Expense</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="property_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a property" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Plumbing repair — unit 2" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="supplies_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplies $</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="labour_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hours</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.25" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600 space-y-1">
              <div className="flex justify-between">
                <span>Supplies × 1.30</span>
                <span>{formatCAD(preview.suppliesMarkedUp)}</span>
              </div>
              <div className="flex justify-between">
                <span>Labour</span>
                <span>{formatCAD(preview.labourAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal (before HST)</span>
                <span>{formatCAD(preview.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>HST 15%</span>
                <span>{formatCAD(preview.hstAmount)}</span>
              </div>
              <div className="flex justify-between font-medium text-stone-800">
                <span>Total (after HST)</span>
                <span>{formatCAD(preview.total)}</span>
              </div>
            </div>

            <FormField
              control={form.control}
              name="staff_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Staff notes (internal)</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional — never shown to owners" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expense_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expense Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving…' : 'Record Expense'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
