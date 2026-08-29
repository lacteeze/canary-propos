'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PROPERTY_TYPE_LABELS, propertyStepSchema, type PropertyStep } from '@/lib/intake/schema'
import { Field } from '../fields'

export function PropertyStepForm({
  defaultValues,
  onBack,
  onContinue,
  isSaving,
}: {
  defaultValues?: Partial<PropertyStep>
  onBack: () => void
  onContinue: (data: PropertyStep) => Promise<void>
  isSaving: boolean
}) {
  const form = useForm<PropertyStep>({
    resolver: zodResolver(propertyStepSchema) as never,
    defaultValues: {
      street_address: defaultValues?.street_address ?? '',
      city: defaultValues?.city ?? "St. John's",
      province: defaultValues?.province ?? 'NL',
      postal_code: defaultValues?.postal_code ?? '',
      property_type: defaultValues?.property_type ?? 'single_family',
      unit_count: defaultValues?.unit_count ?? 1,
    },
  })

  return (
    <form
      onSubmit={form.handleSubmit((values) => onContinue(values))}
      className="cpub-form-card"
    >
      <h2>The property</h2>
      <p className="cpub-form-sub">Unit count decides how many unit cards you fill in next.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Street address" required error={form.formState.errors.street_address?.message}>
          <input autoComplete="street-address" {...form.register('street_address')} />
        </Field>
        <div className="cpub-form-row">
          <Field label="City" required error={form.formState.errors.city?.message}>
            <input autoComplete="address-level2" {...form.register('city')} />
          </Field>
          <Field label="Province" required>
            <input autoComplete="address-level1" {...form.register('province')} />
          </Field>
        </div>
        <Field label="Postal code">
          <input autoComplete="postal-code" {...form.register('postal_code')} />
        </Field>
        <Field label="Property type" required>
          <select {...form.register('property_type')}>
            {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="How many units?" required error={form.formState.errors.unit_count?.message}>
          <input type="number" min={1} max={20} inputMode="numeric" {...form.register('unit_count', { valueAsNumber: true })} />
        </Field>
      </div>

      <div className="cint-nav">
        <button type="button" className="cpub-btn-outline" onClick={onBack} disabled={isSaving}>
          Back
        </button>
        <button type="submit" className="cpub-btn-primary" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </form>
  )
}
