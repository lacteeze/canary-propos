'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { recordPayment } from '@/app/(manager)/payments/actions'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const formSchema = z.object({
  lease_id: z.string().uuid('Please select a lease'),
  amount: z.coerce.number().positive('Amount must be positive'),
  method: z.enum(['etransfer', 'cheque', 'cash', 'bank_transfer']),
  payment_date: z.string().min(1, 'Payment date is required'),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface LeaseOption {
  id: string
  tenant_name: string
  property_address: string
  monthly_rent: number
}

interface RecordPaymentDialogProps {
  leases: LeaseOption[]
  onSuccess?: () => void
}

export function RecordPaymentDialog({ leases, onSuccess }: RecordPaymentDialogProps) {
  const [open, setOpen] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const form = useForm<FormValues, unknown, FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      lease_id: '',
      amount: 0,
      method: 'etransfer',
      payment_date: today,
      notes: '',
    },
  })

  // Pre-populate amount when lease is selected
  function handleLeaseChange(leaseId: string) {
    const lease = leases.find((l) => l.id === leaseId)
    if (lease) {
      form.setValue('amount', lease.monthly_rent)
    }
    form.setValue('lease_id', leaseId)
  }

  async function onSubmit(values: FormValues) {
    const result = await recordPayment(values)
    if (result.success) {
      toast.success('Payment recorded successfully.')
      form.reset({ lease_id: '', amount: 0, method: 'etransfer', payment_date: today, notes: '' })
      setOpen(false)
      onSuccess?.()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<span />} onClick={() => setOpen(true)}>
        <Button variant="default">Record Payment</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Lease */}
            <FormField
              control={form.control}
              name="lease_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lease</FormLabel>
                  <Select
                    onValueChange={(val) => { if (val) handleLeaseChange(val) }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a lease" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {leases.map((lease) => (
                        <SelectItem key={lease.id} value={lease.id}>
                          {lease.tenant_name} — {lease.property_address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ($)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Method */}
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="etransfer">Interac e-Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date */}
            <FormField
              control={form.control}
              name="payment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="e.g. rent for July" {...field} />
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
                {form.formState.isSubmitting ? 'Saving…' : 'Record Payment'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
