'use client'

import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  LAUNDRY_LABELS,
  PETS_LABELS,
  emptyUnit,
  unitsStepSchema,
  type UnitBlock,
  type UnitsStep,
} from '@/lib/intake/schema'
import { Field, RadioList } from '../fields'

function padUnits(existing: Partial<UnitBlock>[] | undefined, count: number): UnitBlock[] {
  const units = (existing ?? []).slice(0, count).map((u) => ({ ...emptyUnit(), ...u }))
  while (units.length < count) units.push(emptyUnit())
  return units
}

export function UnitsStepForm({
  unitCount,
  defaultValues,
  onBack,
  onContinue,
  isSaving,
}: {
  unitCount: number
  defaultValues?: Partial<UnitBlock>[]
  onBack: () => void
  onContinue: (data: UnitsStep) => Promise<void>
  isSaving: boolean
}) {
  const count = Math.min(20, Math.max(1, unitCount || 1))
  const form = useForm<UnitsStep>({
    resolver: zodResolver(unitsStepSchema) as never,
    defaultValues: { units: padUnits(defaultValues, count) },
  })
  useFieldArray({ control: form.control, name: 'units' })

  return (
    <form
      onSubmit={form.handleSubmit((values) => onContinue(values))}
      className="cpub-form-card"
    >
      <h2>Each unit</h2>
      <p className="cpub-form-sub">{count} unit{count === 1 ? '' : 's'} from the last step.</p>

      {Array.from({ length: count }).map((_, index) => {
        const occupied = form.watch(`units.${index}.occupancy_status`) === 'occupied'
        return (
          <div key={index} className="cint-unit">
            <h3>Unit {index + 1}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Label">
                <input
                  {...form.register(`units.${index}.unit_label`)}
                  placeholder='e.g. "Main floor", "Basement"'
                />
              </Field>
              <div className="cpub-form-row">
                <Field label="Beds" required error={form.formState.errors.units?.[index]?.beds?.message}>
                  <input inputMode="decimal" {...form.register(`units.${index}.beds`)} />
                </Field>
                <Field label="Baths" required error={form.formState.errors.units?.[index]?.baths?.message}>
                  <input inputMode="decimal" {...form.register(`units.${index}.baths`)} />
                </Field>
              </div>
              <div className="cpub-form-row">
                <Field label="Sq ft">
                  <input inputMode="numeric" {...form.register(`units.${index}.sqft`)} />
                </Field>
                <Field label="Target rent">
                  <input inputMode="decimal" {...form.register(`units.${index}.target_rent`)} />
                </Field>
              </div>
              <Field label="Occupancy" required>
                <RadioList
                  name={`units.${index}.occupancy_status`}
                  value={form.watch(`units.${index}.occupancy_status`)}
                  onChange={(v) =>
                    form.setValue(`units.${index}.occupancy_status`, v as UnitBlock['occupancy_status'])
                  }
                  options={[
                    { value: 'vacant', label: 'Vacant' },
                    { value: 'occupied', label: 'Occupied' },
                  ]}
                />
              </Field>
              <Field label="Laundry">
                <select {...form.register(`units.${index}.laundry`)}>
                  {Object.entries(LAUNDRY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Parking spaces">
                <input type="number" min={0} inputMode="numeric" {...form.register(`units.${index}.parking_spaces`)} />
              </Field>
              <Field label="Pets allowed">
                <select {...form.register(`units.${index}.pets_allowed`)}>
                  {Object.entries(PETS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Furnished">
                <RadioList
                  name={`units.${index}.furnished`}
                  value={form.watch(`units.${index}.furnished`)}
                  onChange={(v) => form.setValue(`units.${index}.furnished`, v as UnitBlock['furnished'])}
                  options={[
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' },
                  ]}
                />
              </Field>

              {occupied ? (
                <>
                  <Field label="Current tenant name">
                    <input {...form.register(`units.${index}.existing_tenant_name`)} />
                  </Field>
                  <Field label="Current tenant email">
                    <input type="email" inputMode="email" {...form.register(`units.${index}.existing_tenant_email`)} />
                  </Field>
                  <Field label="Current tenant phone">
                    <input type="tel" inputMode="tel" {...form.register(`units.${index}.existing_tenant_phone`)} />
                  </Field>
                  <Field label="Current rent">
                    <input inputMode="decimal" {...form.register(`units.${index}.current_rent`)} />
                  </Field>
                  <Field label="Lease type">
                    <select {...form.register(`units.${index}.lease_type`)}>
                      <option value="">Select</option>
                      <option value="written">Written</option>
                      <option value="verbal">Verbal</option>
                      <option value="not_sure">Not sure</option>
                    </select>
                  </Field>
                  <Field label="Lease end date">
                    <input type="date" {...form.register(`units.${index}.lease_end_date`)} />
                  </Field>
                  <Field label="Deposit held">
                    <input inputMode="decimal" {...form.register(`units.${index}.deposit_held`)} />
                  </Field>
                  <Field label="Who holds the deposit?">
                    <select {...form.register(`units.${index}.deposit_holder`)}>
                      <option value="">Select</option>
                      <option value="owner">Owner</option>
                      <option value="agent">Agent</option>
                      <option value="none">None</option>
                    </select>
                  </Field>
                  <Field label="Expected move-out">
                    <input type="date" {...form.register(`units.${index}.expected_move_out`)} />
                  </Field>
                </>
              ) : null}
            </div>
          </div>
        )
      })}

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
