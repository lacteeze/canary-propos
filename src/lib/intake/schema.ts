import { z } from 'zod'
import type { Json } from '@/types/supabase'

export const INTAKE_STEP_COUNT = 7

export const STEP_TITLES = [
  'Contact',
  'Property',
  'Property details',
  'Units',
  'Utilities',
  'Responsibilities',
  'Photos and review',
] as const

const optionalText = z
  .string()
  .optional()
  .transform((v) => {
    if (v == null) return undefined
    const trimmed = v.trim()
    return trimmed === '' ? undefined : trimmed
  })

function optionalEnum<T extends string>(values: readonly [T, ...T[]]) {
  return z
    .union([z.enum(values), z.literal('')])
    .optional()
    .transform((v) => (v ? v : undefined))
}

export const contactStepSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().min(1, 'Phone is required'),
  how_heard: optionalText,
})

export const propertyStepSchema = z.object({
  street_address: z.string().trim().min(1, 'Street address is required'),
  city: z.string().trim().min(1, 'City is required'),
  province: z.string().trim().min(1),
  postal_code: optionalText,
  property_type: z.enum([
    'single_family',
    'duplex',
    'triplex',
    'four_plus',
    'condo',
    'other',
  ]),
  unit_count: z.number({ error: 'Enter how many units' }).int().min(1).max(20),
})

export const propertyDetailsStepSchema = z.object({
  year_built: z.string().trim().min(1, 'Year built is required'),
  storeys: z.string().trim().min(1, 'Storeys is required'),
  heating_type: z.enum([
    'electric_baseboard',
    'oil',
    'heat_pump',
    'mini_split',
    'forced_air',
    'other',
  ]),
  water_heater_type: z.enum(['electric', 'oil', 'tankless', 'other']),
  water_heater_age: optionalText,
  has_firewall: z.enum(['yes', 'no', 'not_sure']),
  roof_year: optionalText,
  electrical_panel: z.enum(['breaker', 'fuse', 'not_sure']),
  oil_tank_year: optionalText,
})

export const unitBlockSchema = z.object({
  unit_label: optionalText,
  beds: z.string().trim().min(1, 'Beds is required'),
  baths: z.string().trim().min(1, 'Baths is required'),
  sqft: optionalText,
  target_rent: optionalText,
  occupancy_status: z.enum(['vacant', 'occupied']),
  laundry: z.enum(['in_unit', 'shared', 'none']),
  parking_spaces: optionalText,
  pets_allowed: z.enum(['yes', 'no', 'negotiable']),
  furnished: z.enum(['yes', 'no']),
  existing_tenant_name: optionalText,
  existing_tenant_email: optionalText,
  existing_tenant_phone: optionalText,
  current_rent: optionalText,
  lease_type: optionalEnum(['written', 'verbal', 'not_sure']),
  lease_end_date: optionalText,
  deposit_held: optionalText,
  deposit_holder: optionalEnum(['owner', 'agent', 'none']),
  expected_move_out: optionalText,
})

export const unitsStepSchema = z.object({
  units: z.array(unitBlockSchema).min(1).max(20),
})

export const utilityUnitSchema = z.object({
  electricity_meter_number: optionalText,
  meter_location: optionalText,
  heat_included_in_rent: z.enum(['yes', 'no']),
  light_included_in_rent: z.enum(['yes', 'no']),
  water_included_in_rent: z.enum(['yes', 'no']),
  internet_included_in_rent: z.enum(['yes', 'no']),
})

export const utilitiesStepSchema = z.object({
  separately_metered: z.enum(['yes', 'no', 'not_sure']),
  units: z.array(utilityUnitSchema).max(20),
})

export const responsibilitiesStepSchema = z.object({
  garbage_responsibility: z.enum(['tenant', 'owner', 'shared']),
  lawn_responsibility: z.enum(['tenant', 'owner', 'contractor']),
  snow_responsibility: z.enum(['tenant', 'owner', 'contractor']),
  access_method: z.enum(['door_code', 'keys', 'lockbox', 'not_sure']),
  notes: optionalText,
})

export const photosStepSchema = z.object({
  paths: z.array(z.string()).default([]),
})

export type ContactStep = z.infer<typeof contactStepSchema>
export type PropertyStep = z.infer<typeof propertyStepSchema>
export type PropertyDetailsStep = z.infer<typeof propertyDetailsStepSchema>
export type UnitBlock = z.infer<typeof unitBlockSchema>
export type UnitsStep = z.infer<typeof unitsStepSchema>
export type UtilityUnit = z.infer<typeof utilityUnitSchema>
export type UtilitiesStep = z.infer<typeof utilitiesStepSchema>
export type ResponsibilitiesStep = z.infer<typeof responsibilitiesStepSchema>
export type PhotosStep = z.infer<typeof photosStepSchema>

export type IntakePayload = {
  contact?: Partial<ContactStep>
  property?: Partial<PropertyStep>
  details?: Partial<PropertyDetailsStep>
  units?: Partial<UnitBlock>[]
  utilities?: {
    separately_metered?: UtilitiesStep['separately_metered']
    units?: Partial<UtilityUnit>[]
  }
  responsibilities?: Partial<ResponsibilitiesStep>
  photos?: { paths?: string[] }
  resume_email_sent?: boolean
}

export type IntakeStatus = 'draft' | 'submitted' | 'promoted' | 'archived'

export type IntakeSubmission = {
  id: string
  org_id: string
  token: string
  contact_name: string | null
  contact_email: string | null
  property_address: string | null
  payload: IntakePayload
  current_step: number
  status: IntakeStatus
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export const PROPERTY_TYPE_LABELS: Record<PropertyStep['property_type'], string> = {
  single_family: 'Single family',
  duplex: 'Duplex',
  triplex: 'Triplex',
  four_plus: '4+ units',
  condo: 'Condo',
  other: 'Other',
}

export const HEATING_LABELS: Record<PropertyDetailsStep['heating_type'], string> = {
  electric_baseboard: 'Electric baseboard',
  oil: 'Oil',
  heat_pump: 'Heat pump',
  mini_split: 'Mini split',
  forced_air: 'Forced air',
  other: 'Other',
}

export const WATER_HEATER_LABELS: Record<PropertyDetailsStep['water_heater_type'], string> = {
  electric: 'Electric',
  oil: 'Oil',
  tankless: 'Tankless',
  other: 'Other',
}

export const YES_NO_UNSURE: Record<'yes' | 'no' | 'not_sure', string> = {
  yes: 'Yes',
  no: 'No',
  not_sure: 'Not sure',
}

export const PANEL_LABELS: Record<PropertyDetailsStep['electrical_panel'], string> = {
  breaker: 'Breaker',
  fuse: 'Fuse',
  not_sure: 'Not sure',
}

export const LAUNDRY_LABELS: Record<UnitBlock['laundry'], string> = {
  in_unit: 'In-unit',
  shared: 'Shared',
  none: 'None',
}

export const PETS_LABELS: Record<UnitBlock['pets_allowed'], string> = {
  yes: 'Yes',
  no: 'No',
  negotiable: 'Negotiable',
}

export function emptyUnit(): UnitBlock {
  return {
    unit_label: undefined,
    beds: '',
    baths: '',
    sqft: undefined,
    target_rent: undefined,
    occupancy_status: 'vacant',
    laundry: 'none',
    parking_spaces: undefined,
    pets_allowed: 'no',
    furnished: 'no',
    existing_tenant_name: undefined,
    existing_tenant_email: undefined,
    existing_tenant_phone: undefined,
    current_rent: undefined,
    lease_type: undefined,
    lease_end_date: undefined,
    deposit_held: undefined,
    deposit_holder: undefined,
    expected_move_out: undefined,
  }
}

export function emptyUtilityUnit(includedDefault: 'yes' | 'no' = 'no'): UtilityUnit {
  return {
    electricity_meter_number: undefined,
    meter_location: undefined,
    heat_included_in_rent: includedDefault,
    light_included_in_rent: includedDefault,
    water_included_in_rent: includedDefault,
    internet_included_in_rent: includedDefault,
  }
}

export function parsePayload(raw: Json | null | undefined): IntakePayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return raw as IntakePayload
}

export function payloadToJson(payload: IntakePayload): Json {
  return payload as Json
}

export function formatPropertyAddress(property?: Partial<PropertyStep> | null): string | null {
  if (!property?.street_address) return null
  return [property.street_address, property.city, property.province, property.postal_code]
    .filter(Boolean)
    .join(', ')
}

export function stepSchemaFor(step: number) {
  switch (step) {
    case 1:
      return contactStepSchema
    case 2:
      return propertyStepSchema
    case 3:
      return propertyDetailsStepSchema
    case 4:
      return unitsStepSchema
    case 5:
      return utilitiesStepSchema
    case 6:
      return responsibilitiesStepSchema
    default:
      return z.object({}).passthrough()
  }
}

export function mergeStepIntoPayload(
  payload: IntakePayload,
  step: number,
  data: Record<string, unknown>,
): IntakePayload {
  const next = { ...payload }
  switch (step) {
    case 1: {
      const { preferred_contact: _ignored, ...contact } = data
      next.contact = contact as Partial<ContactStep>
      break
    }
    case 2:
      next.property = data as Partial<PropertyStep>
      break
    case 3:
      next.details = data as Partial<PropertyDetailsStep>
      break
    case 4:
      next.units = (data.units as Partial<UnitBlock>[]) ?? []
      break
    case 5:
      next.utilities = data as IntakePayload['utilities']
      break
    case 6:
      next.responsibilities = data as Partial<ResponsibilitiesStep>
      break
    case 7:
      if (data.paths) {
        next.photos = { paths: data.paths as string[] }
      }
      break
    default:
      break
  }
  return next
}
