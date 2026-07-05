'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { recordExpense } from '@/app/(manager)/payments/actions'
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
  vendor_cost: z.coerce.number().min(0, 'Vendor cost must be 0 or more'),
  billed_amount: z.coerce.number().min(0, 'Billed amount must be 0 or more'),
  expense_date: z.string().min(1, 'Expense date is required'),
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

export function RecordExpenseDialog({ properties, onSuccess }: RecordExpenseDialogProps) {
  const [open, setOpen] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const form = useForm<FormValues, unknown, FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      property_id: '',
      description: '',
      vendor_cost: 0,
      billed_amount: 0,
      expense_date: today,
    },
  })

  async function onSubmit(values: FormValues) {
    const result = await recordExpense(values)
    if (result.success) {
      toast.success('Expense recorded successfully.')
      form.reset({
        property_id: '',
        description: '',
        vendor_cost: 0,
        billed_amount: 0,
        expense_date: today,
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
            {/* Property */}
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

            {/* Description */}
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

            {/* Vendor Cost + Billed Amount */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vendor_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor Cost (internal)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="billed_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billed to Owner</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <p className="text-xs text-stone-500 -mt-2">
              Vendor cost is for internal records only — owners see billed amount.
            </p>

            {/* Date */}
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
