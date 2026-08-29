'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { contactStepSchema, type ContactStep } from '@/lib/intake/schema'
import { Field } from '../fields'

export function ContactStepForm({
  defaultValues,
  onContinue,
  isSaving,
}: {
  defaultValues?: Partial<ContactStep>
  onContinue: (data: ContactStep) => Promise<void>
  isSaving: boolean
}) {
  const form = useForm<ContactStep>({
    resolver: zodResolver(contactStepSchema) as never,
    defaultValues: {
      full_name: defaultValues?.full_name ?? '',
      email: defaultValues?.email ?? '',
      phone: defaultValues?.phone ?? '',
      how_heard: defaultValues?.how_heard ?? '',
    },
  })

  return (
    <form
      onSubmit={form.handleSubmit((values) => onContinue(values))}
      className="cpub-form-card"
    >
      <h2>How can we reach you?</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Full name" required error={form.formState.errors.full_name?.message}>
          <input autoComplete="name" {...form.register('full_name')} />
        </Field>
        <Field label="Email" required error={form.formState.errors.email?.message}>
          <input type="email" autoComplete="email" inputMode="email" {...form.register('email')} />
        </Field>
        <Field label="Phone" required error={form.formState.errors.phone?.message}>
          <input type="tel" autoComplete="tel" inputMode="tel" {...form.register('phone')} />
        </Field>
        <Field label="How did you hear about us?" error={form.formState.errors.how_heard?.message}>
          <input {...form.register('how_heard')} placeholder="Optional" />
        </Field>
      </div>

      <div className="cint-nav cint-nav--end">
        <button type="submit" className="cpub-btn-primary" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </form>
  )
}
