'use client'

import { useEffect } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  YES_NO_UNSURE,
  emptyUtilityUnit,
  utilitiesStepSchema,
  type UtilitiesStep,
  type UtilityUnit,
} from '@/lib/intake/schema'
import { Field, RadioList } from '../fields'

function padUtils(existing: Partial<UtilityUnit>[] | undefined, count: number, included: 'yes' | 'no') {
  const units = (existing ?? []).slice(0, count).map((u) => ({ ...emptyUtilityUnit(included), ...u }))
  while (units.length < count) units.push(emptyUtilityUnit(included))
  return units
}

export function UtilitiesStepForm({
  unitCount,
  defaultValues,
  onBack,
  onContinue,
  isSaving,
}: {
  unitCount: number
  defaultValues?: UtilitiesStep
  onBack: () => void
  onContinue: (data: UtilitiesStep) => Promise<void>
  isSaving: boolean
}) {
  const count = Math.min(20, Math.max(1, unitCount || 1))
  const form = useForm<UtilitiesStep>({
    resolver: zodResolver(utilitiesStepSchema) as never,
    defaultValues: {
      separately_metered: defaultValues?.separately_metered ?? 'not_sure',
      units: padUtils(defaultValues?.units, count, defaultValues?.separately_metered === 'no' ? 'yes' : 'no'),
    },
  })
  useFieldArray({ control: form.control, name: 'units' })
  const metered = form.watch('separately_metered')

  useEffect(() => {
    if (metered !== 'no') return
    for (let i = 0; i < count; i++) {
      form.setValue(`units.${i}.heat_included_in_rent`, 'yes')
      form.setValue(`units.${i}.light_included_in_rent`, 'yes')
      form.setValue(`units.${i}.water_included_in_rent`, 'yes')
      form.setValue(`units.${i}.internet_included_in_rent`, 'yes')
    }
  }, [metered, count, form])

  return (
    <form
      onSubmit={form.handleSubmit((values) => onContinue(values))}
      className="cpub-form-card"
    >
      <h2>Utilities and meters</h2>
      <p className="cpub-form-sub">Start here — it changes the questions below.</p>

      <Field label="Separately metered?" required>
        <RadioList
          name="separately_metered"
          value={metered}
          onChange={(v) => form.setValue('separately_metered', v as UtilitiesStep['separately_metered'])}
          options={Object.entries(YES_NO_UNSURE).map(([value, label]) => ({ value, label }))}
        />
      </Field>

      {metered === 'no' ? (
        <p className="cint-note">
          If units are not separately metered, utilities generally must be included in rent. We
          defaulted the toggles below to yes.
        </p>
      ) : null}

      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="cint-unit">
          <h3>Unit {index + 1}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Electricity meter number">
              <input {...form.register(`units.${index}.electricity_meter_number`)} />
            </Field>
            <Field label="Meter location">
              <input {...form.register(`units.${index}.meter_location`)} />
            </Field>
            {(
              [
                ['heat_included_in_rent', 'Heat included in rent?'],
                ['light_included_in_rent', 'Electricity / lights included?'],
                ['water_included_in_rent', 'Water included?'],
                ['internet_included_in_rent', 'Internet included?'],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <RadioList
                  name={`units.${index}.${key}`}
                  value={form.watch(`units.${index}.${key}`)}
                  onChange={(v) => form.setValue(`units.${index}.${key}`, v as 'yes' | 'no')}
                  options={[
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' },
                  ]}
                />
              </Field>
            ))}
          </div>
        </div>
      ))}

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
