'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  HEATING_LABELS,
  PANEL_LABELS,
  WATER_HEATER_LABELS,
  YES_NO_UNSURE,
  propertyDetailsStepSchema,
  type PropertyDetailsStep,
} from '@/lib/intake/schema'
import { Field, RadioList } from '../fields'

export function PropertyDetailsStepForm({
  defaultValues,
  onBack,
  onContinue,
  isSaving,
}: {
  defaultValues?: Partial<PropertyDetailsStep>
  onBack: () => void
  onContinue: (data: PropertyDetailsStep) => Promise<void>
  isSaving: boolean
}) {
  const form = useForm<PropertyDetailsStep>({
    resolver: zodResolver(propertyDetailsStepSchema) as never,
    defaultValues: {
      year_built: defaultValues?.year_built ?? '',
      storeys: defaultValues?.storeys ?? '',
      heating_type: defaultValues?.heating_type ?? 'electric_baseboard',
      water_heater_type: defaultValues?.water_heater_type ?? 'electric',
      water_heater_age: defaultValues?.water_heater_age ?? '',
      has_firewall: defaultValues?.has_firewall ?? 'not_sure',
      roof_year: defaultValues?.roof_year ?? '',
      electrical_panel: defaultValues?.electrical_panel ?? 'not_sure',
      oil_tank_year: defaultValues?.oil_tank_year ?? '',
    },
  })

  const heating = form.watch('heating_type')
  const waterHeater = form.watch('water_heater_type')
  const showOilTank = heating === 'oil' || waterHeater === 'oil'

  return (
    <form
      onSubmit={form.handleSubmit((values) => onContinue(values))}
      className="cpub-form-card"
    >
      <h2>Building details</h2>
      <p className="cpub-form-sub">
        Your future tenants&apos; insurance companies will ask for these.
      </p>
      <p className="cint-note">&quot;Not sure&quot; is a valid answer. Don&apos;t guess.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="cpub-form-row">
          <Field label="Year built" required error={form.formState.errors.year_built?.message}>
            <input inputMode="numeric" {...form.register('year_built')} />
          </Field>
          <Field label="Storeys" required error={form.formState.errors.storeys?.message}>
            <input inputMode="numeric" {...form.register('storeys')} />
          </Field>
        </div>
        <Field label="Heating type" required>
          <select {...form.register('heating_type')}>
            {Object.entries(HEATING_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Water heater type" required>
          <select {...form.register('water_heater_type')}>
            {Object.entries(WATER_HEATER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Water heater age">
          <input {...form.register('water_heater_age')} placeholder="Optional" />
        </Field>
        <Field label="Firewall between units?" required>
          <RadioList
            name="has_firewall"
            value={form.watch('has_firewall')}
            onChange={(v) => form.setValue('has_firewall', v as PropertyDetailsStep['has_firewall'])}
            options={Object.entries(YES_NO_UNSURE).map(([value, label]) => ({ value, label }))}
          />
        </Field>
        <Field label="Roof year">
          <input inputMode="numeric" {...form.register('roof_year')} placeholder="Optional" />
        </Field>
        <Field label="Electrical panel" required>
          <select {...form.register('electrical_panel')}>
            {Object.entries(PANEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        {showOilTank ? (
          <Field label="Oil tank year">
            <input inputMode="numeric" {...form.register('oil_tank_year')} placeholder="Optional" />
          </Field>
        ) : null}
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
