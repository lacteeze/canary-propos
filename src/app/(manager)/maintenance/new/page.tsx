'use client'
// src/app/(manager)/maintenance/new/page.tsx
// Create work order form — react-hook-form + zod, creates draft work order.

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { createWorkOrder } from '@/app/actions/work-orders'

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().min(1, 'Description is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  property_id: z.string().min(1, 'Property is required'),
  unit_id: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface PropertyOption {
  id: string
  street_address: string
  city: string
}

interface UnitOption {
  id: string
  unit_number: string
}

export default function NewWorkOrderPage() {
  const router = useRouter()
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])
  const [loadingProperties, setLoadingProperties] = useState(true)
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      priority: 'medium',
    },
  })

  const selectedPropertyId = watch('property_id')

  // Load properties on mount
  useEffect(() => {
    async function loadProperties() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: person } = await supabase
        .from('people')
        .select('org_id')
        .eq('user_id', user.id)
        .eq('active', true)
        .single()

      if (!person) return

      const { data } = await supabase
        .from('properties')
        .select('id, street_address, city')
        .eq('org_id', person.org_id)
        .order('street_address')

      setProperties(data ?? [])
      setLoadingProperties(false)
    }
    loadProperties()
  }, [])

  // Load units when property changes
  useEffect(() => {
    if (!selectedPropertyId) {
      setUnits([])
      return
    }
    async function loadUnits() {
      const supabase = createClient()
      const { data } = await supabase
        .from('units')
        .select('id, unit_number')
        .eq('property_id', selectedPropertyId)
        .order('unit_number')
      // Coerce nullable unit_number — DB allows null but UnitOption requires string
      setUnits(
        (data ?? []).map((u) => ({ id: u.id, unit_number: u.unit_number ?? '' }))
      )
    }
    loadUnits()
  }, [selectedPropertyId])

  async function onSubmit(values: FormValues) {
    setServerError(null)
    setSubmitting(true)
    try {
      const result = await createWorkOrder({
        property_id: values.property_id,
        unit_id: values.unit_id || undefined,
        title: values.title,
        description: values.description,
        priority: values.priority,
      })
      if (!result.success) {
        setServerError(result.error)
      } else {
        router.push('/maintenance')
      }
    } catch {
      setServerError('An unexpected error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      {/* Back link */}
      <div className="mb-4">
        <Link href="/maintenance" className="text-sm text-stone-500 hover:text-stone-700">
          ← Maintenance
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-xl font-semibold text-stone-900">New Work Order</h1>
        <p className="mt-1 text-sm text-stone-500">
          Creates a draft work order. Submit it from the detail page to begin the workflow.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-stone-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            {...register('title')}
            placeholder="e.g. Fix leaking kitchen faucet"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-stone-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            rows={4}
            {...register('description')}
            placeholder="Describe the issue in detail…"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none resize-none"
          />
          {errors.description && (
            <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
          )}
        </div>

        {/* Priority */}
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-stone-700 mb-1">
            Priority <span className="text-red-500">*</span>
          </label>
          <select
            id="priority"
            {...register('priority')}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none bg-white"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          {errors.priority && (
            <p className="mt-1 text-xs text-red-600">{errors.priority.message}</p>
          )}
        </div>

        {/* Property */}
        <div>
          <label htmlFor="property_id" className="block text-sm font-medium text-stone-700 mb-1">
            Property <span className="text-red-500">*</span>
          </label>
          <select
            id="property_id"
            {...register('property_id')}
            disabled={loadingProperties}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none bg-white disabled:bg-stone-50 disabled:text-stone-400"
          >
            <option value="">
              {loadingProperties ? 'Loading properties…' : 'Select a property'}
            </option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.street_address}, {p.city}
              </option>
            ))}
          </select>
          {errors.property_id && (
            <p className="mt-1 text-xs text-red-600">{errors.property_id.message}</p>
          )}
        </div>

        {/* Unit (optional, shown when property selected and has units) */}
        {selectedPropertyId && (
          <div>
            <label htmlFor="unit_id" className="block text-sm font-medium text-stone-700 mb-1">
              Unit <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <select
              id="unit_id"
              {...register('unit_id')}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none bg-white"
            >
              <option value="">Whole property / no specific unit</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  Unit {u.unit_number}
                </option>
              ))}
            </select>
          </div>
        )}

        {serverError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create Work Order'}
          </button>
          <Link
            href="/maintenance"
            className="rounded-lg border border-stone-300 px-5 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
