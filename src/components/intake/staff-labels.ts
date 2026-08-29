import {
  HEATING_LABELS,
  LAUNDRY_LABELS,
  PANEL_LABELS,
  PETS_LABELS,
  PROPERTY_TYPE_LABELS,
  WATER_HEATER_LABELS,
  YES_NO_UNSURE,
  type IntakeStatus,
} from '@/lib/intake/schema'

export const INTAKE_STATUS_LABELS: Record<IntakeStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  promoted: 'Promoted',
  archived: 'Archived',
}

export const ACCESS_LABELS: Record<string, string> = {
  door_code: 'Door code',
  keys: 'Keys',
  lockbox: 'Lockbox',
  not_sure: 'Not sure',
}

export const WHO_LABELS: Record<string, string> = {
  tenant: 'Tenant',
  owner: 'Owner',
  shared: 'Shared',
  contractor: 'Contractor',
}

export function labelOf(map: Record<string, string>, value?: string | null) {
  if (!value) return '—'
  return map[value] ?? value
}

export function formatWhen(iso?: string | null) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export {
  HEATING_LABELS,
  LAUNDRY_LABELS,
  PANEL_LABELS,
  PETS_LABELS,
  PROPERTY_TYPE_LABELS,
  WATER_HEATER_LABELS,
  YES_NO_UNSURE,
}
