'use client'

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
    <div className="cy-portal-page" style={{ maxWidth: 560 }}>
      <div className="cy-portal-page-head">
        <h1 className="cy-portal-title">Submit a maintenance request</h1>
        <Link href="/my-home/maintenance" className="cy-portal-link">
          Cancel
        </Link>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="cy-portal-card" style={{ display: 'grid', gap: 18 }}>
        <div className="cy-portal-field">
          <label htmlFor="title" className="cy-portal-label">
            Issue title <span style={{ color: 'var(--red)' }}>*</span>
          </label>
          <input
            id="title"
            type="text"
            placeholder="e.g. Leaking faucet in bathroom"
            {...register('title')}
            className="cy-input"
          />
          {errors.title && (
            <p className="cy-portal-alert cy-portal-alert--err" style={{ margin: 0, padding: '8px 10px' }}>
              {errors.title.message}
            </p>
          )}
        </div>

        <div className="cy-portal-field">
          <label htmlFor="description" className="cy-portal-label">
            Description
          </label>
          <textarea
            id="description"
            rows={4}
            placeholder="Describe the issue — when it started, what you noticed, any relevant context."
            {...register('description')}
            className="cy-input"
            style={{ resize: 'vertical', minHeight: 100 }}
          />
          {errors.description && (
            <p className="cy-portal-alert cy-portal-alert--err" style={{ margin: 0, padding: '8px 10px' }}>
              {errors.description.message}
            </p>
          )}
        </div>

        <div className="cy-portal-field">
          <label htmlFor="priority" className="cy-portal-label">
            Priority
          </label>
          <select id="priority" {...register('priority')} className="cy-select cy-select--field">
            <option value="low">Low — not urgent, convenient timing</option>
            <option value="medium">Medium — should be addressed soon</option>
            <option value="high">High — affecting daily use</option>
            <option value="urgent">Urgent — safety or major damage risk</option>
          </select>
        </div>

        {serverError && <div className="cy-portal-alert cy-portal-alert--err">{serverError}</div>}

        <div className="cy-portal-actions" style={{ marginTop: 0 }}>
          <button type="submit" disabled={submitting} className="cy-btn-primary" style={{ flex: 1 }}>
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
          <Link href="/my-home/maintenance" className="cy-btn" style={{ flex: 1 }}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
