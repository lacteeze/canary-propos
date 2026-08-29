'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { responsibilitiesStepSchema, type ResponsibilitiesStep } from '@/lib/intake/schema'
import { Field, RadioList } from '../fields'

export function ResponsibilitiesStepForm({
  defaultValues,
  onBack,
  onContinue,
  isSaving,
}: {
  defaultValues?: Partial<ResponsibilitiesStep>
  onBack: () => void
  onContinue: (data: ResponsibilitiesStep) => Promise<void>
  isSaving: boolean
}) {
  const form = useForm<ResponsibilitiesStep>({
    resolver: zodResolver(responsibilitiesStepSchema) as never,
    defaultValues: {
      garbage_responsibility: defaultValues?.garbage_responsibility ?? 'tenant',
      lawn_responsibility: defaultValues?.lawn_responsibility ?? 'tenant',
      snow_responsibility: defaultValues?.snow_responsibility ?? 'tenant',
      access_method: defaultValues?.access_method ?? 'not_sure',
      notes: defaultValues?.notes ?? '',
    },
  })

  return (
    <form
      onSubmit={form.handleSubmit((values) => onContinue(values))}
      className="cpub-form-card"
    >
      <h2>Responsibilities and access</h2>
      <p className="cpub-form-sub">Who handles what, and how we get in.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Garbage" required>
          <RadioList
            name="garbage_responsibility"
            value={form.watch('garbage_responsibility')}
            onChange={(v) =>
              form.setValue('garbage_responsibility', v as ResponsibilitiesStep['garbage_responsibility'])
            }
            options={[
              { value: 'tenant', label: 'Tenant' },
              { value: 'owner', label: 'Owner' },
              { value: 'shared', label: 'Shared' },
            ]}
          />
        </Field>
        <Field label="Lawn" required>
          <RadioList
            name="lawn_responsibility"
            value={form.watch('lawn_responsibility')}
            onChange={(v) =>
              form.setValue('lawn_responsibility', v as ResponsibilitiesStep['lawn_responsibility'])
            }
            options={[
              { value: 'tenant', label: 'Tenant' },
              { value: 'owner', label: 'Owner' },
              { value: 'contractor', label: 'Contractor' },
            ]}
          />
        </Field>
        <Field label="Snow" required>
          <RadioList
            name="snow_responsibility"
            value={form.watch('snow_responsibility')}
            onChange={(v) =>
              form.setValue('snow_responsibility', v as ResponsibilitiesStep['snow_responsibility'])
            }
            options={[
              { value: 'tenant', label: 'Tenant' },
              { value: 'owner', label: 'Owner' },
              { value: 'contractor', label: 'Contractor' },
            ]}
          />
        </Field>
        <Field label="Access method" required>
          <RadioList
            name="access_method"
            value={form.watch('access_method')}
            onChange={(v) => form.setValue('access_method', v as ResponsibilitiesStep['access_method'])}
            options={[
              { value: 'door_code', label: 'Door code' },
              { value: 'keys', label: 'Keys' },
              { value: 'lockbox', label: 'Lockbox' },
              { value: 'not_sure', label: 'Not sure' },
            ]}
          />
        </Field>
        <Field label="Notes">
          <textarea {...form.register('notes')} placeholder="Anything else we should know?" />
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
