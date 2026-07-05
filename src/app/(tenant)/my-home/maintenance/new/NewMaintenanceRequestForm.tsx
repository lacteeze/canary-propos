'use client'

// src/app/(tenant)/my-home/maintenance/new/NewMaintenanceRequestForm.tsx
// Client component — form state + submission. Property/unit IDs come from the RSC wrapper.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createWorkOrder } from '@/app/actions/work-orders'
import Link from 'next/link'

const formSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
})
type FormValues = z.infer<typeof formSchema>

interface Props {
  propertyId: string
  unitId: string | null
}

export default function NewMaintenanceRequestForm({ propertyId, unitId }: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { priority: 'medium' },
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    setSubmitting(true)
    try {
      const result = await createWorkOrder({
        property_id: propertyId,
        unit_id: unitId ?? undefined,
        title: values.title,
        description: values.description,
        priority: values.priority,
      })
      if (!result.success) {
        setServerError(result.error)
        return
      }
      router.push('/my-home/maintenance?submitted=1')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 md:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-900">Submit a Maintenance Request</h1>
        <Link
          href="/my-home/maintenance"
          className="text-sm text-stone-500 underline underline-offset-2 hover:text-stone-800"
        >
          Cancel
        </Link>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Title */}
        <div>
          <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-stone-700">
            Issue Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            placeholder="e.g. Leaking faucet in bathroom"
            {...register('title')}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-stone-700">
            Description <span className="text-sm font-normal text-stone-400">(required)</span>
          </label>
          <textarea
            id="description"
            rows={4}
            placeholder="Describe the issue — when it started, what you noticed, any relevant context."
            {...register('description')}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
          />
          {errors.description && (
            <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
          )}
        </div>

        {/* Priority */}
        <div>
          <label htmlFor="priority" className="mb-1.5 block text-sm font-medium text-stone-700">
            Priority
          </label>
          <select
            id="priority"
            {...register('priority')}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
          >
            <option value="low">Low — not urgent, convenient timing</option>
            <option value="medium">Medium — should be addressed soon</option>
            <option value="high">High — affecting daily use</option>
            <option value="urgent">Urgent — safety or major damage risk</option>
          </select>
          {errors.priority && (
            <p className="mt-1 text-xs text-red-600">{errors.priority.message}</p>
          )}
        </div>

        {serverError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
          <Link
            href="/my-home/maintenance"
            className="flex-1 rounded-lg border border-stone-300 px-4 py-2.5 text-center text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
