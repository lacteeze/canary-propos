'use server'

// Bulk CSV import server action for the CanaryApp.
// Accepts raw CSV text per dataset, validates every row, resolves references
// (emails → people, addresses → properties/units, portfolio names → ids),
// then inserts through the RLS-scoped client. Returns per-row errors so the
// UI can show exactly which lines need fixing.
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseCsvForDataset, type ImportDataset } from '@/lib/canary/import-specs'

const MAX_ROWS = 2000
const CHUNK = 100

export interface ImportRowError {
  line: number
  message: string
}

export type ImportResult =
  | {
      success: true
      inserted: number
      skipped: number
      errors: ImportRowError[]
    }
  | { success: false; error: string }

async function getStaffContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: person } = await supabase
    .from('people')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) return null
  const roles = (person.role as unknown as string[]) ?? []
  if (!roles.includes('manager') && !roles.includes('admin')) return null
  return { supabase, person }
}

type Ctx = NonNullable<Awaited<ReturnType<typeof getStaffContext>>>

// ---------- shared helpers ----------

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
  .refine((s) => !Number.isNaN(new Date(s + 'T00:00:00').getTime()), 'is not a valid date')

const moneyStr = (label: string) =>
  z.preprocess(
    (v) => String(v ?? '').replace(/[$,\s]/g, ''),
    z.coerce.number().nonnegative(`${label} must be a number`)
  )

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function firstIssue(err: z.ZodError): string {
  const issue = err.issues[0]
  const path = issue?.path?.join('.')
  return (path ? path + ' ' : '') + (issue?.message ?? 'is invalid')
}

type ImportTable = 'people' | 'portfolios' | 'units' | 'leases' | 'payments' | 'work_orders'

/** Insert rows in chunks; on chunk failure retry rows one-by-one to attribute errors. */
async function chunkedInsert(
  ctx: Ctx,
  table: ImportTable,
  rows: { line: number; record: Record<string, unknown> }[],
  errors: ImportRowError[]
): Promise<number> {
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await ctx.supabase.from(table).insert(chunk.map((r) => r.record) as never[])
    if (!error) {
      inserted += chunk.length
      continue
    }
    for (const r of chunk) {
      const { error: rowErr } = await ctx.supabase.from(table).insert(r.record as never)
      if (rowErr) {
        console.error(`[importCsv:${table}]`, rowErr)
        errors.push({ line: r.line, message: friendlyDbError(rowErr.message) })
      } else {
        inserted++
      }
    }
  }
  return inserted
}

function friendlyDbError(message: string): string {
  if (/plan_unit_limit_exceeded/.test(message)) return 'Your plan unit limit has been reached.'
  if (/duplicate key/.test(message)) return 'Duplicate — this record already exists.'
  if (/violates row-level security/.test(message)) return 'Not permitted by your role.'
  return 'Database rejected this row: ' + message.slice(0, 140)
}

// ---------- lookup loaders ----------

async function loadPeopleByEmail(ctx: Ctx) {
  const { data } = await ctx.supabase
    .from('people')
    .select('id, email, role')
    .eq('org_id', ctx.person.org_id)
  const map = new Map<string, { id: string; roles: string[] }>()
  for (const p of data ?? []) {
    map.set(normKey(p.email ?? ''), { id: p.id, roles: (p.role as unknown as string[]) ?? [] })
  }
  return map
}

async function loadPortfoliosByName(ctx: Ctx) {
  const { data } = await ctx.supabase
    .from('portfolios')
    .select('id, name')
    .eq('org_id', ctx.person.org_id)
  const map = new Map<string, string>()
  for (const pf of data ?? []) map.set(normKey(pf.name ?? ''), pf.id)
  return map
}

interface UnitRef {
  unitId: string
  propertyId: string
  unitNumber: string
}

/** Map of normalized street address → units on that property (across the org). */
async function loadUnitsByAddress(ctx: Ctx) {
  const { data } = await ctx.supabase
    .from('units')
    .select('id, unit_number, property_id, properties!property_id(id, street_address, city)')
    .eq('org_id', ctx.person.org_id)
  const map = new Map<string, UnitRef[]>()
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  for (const u of (data ?? []) as any[]) {
    if (!u.properties) continue
    const key = normKey(u.properties.street_address ?? '')
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push({
      unitId: u.id,
      propertyId: u.property_id,
      unitNumber: normKey(u.unit_number ?? ''),
    })
  }
  return map
}

function resolveUnit(
  unitsByAddress: Map<string, UnitRef[]>,
  address: string,
  unitNumber: string
): { unit?: UnitRef; error?: string } {
  const units = unitsByAddress.get(normKey(address))
  if (!units || units.length === 0) {
    return { error: `no property found matching "${address}" — import Properties first` }
  }
  const un = normKey(unitNumber)
  if (un) {
    const match = units.find((u) => u.unitNumber === un)
    return match
      ? { unit: match }
      : { error: `property "${address}" has no unit "${unitNumber}"` }
  }
  if (units.length > 1) {
    return { error: `property "${address}" has ${units.length} units — specify unit_number` }
  }
  return { unit: units[0] }
}

// ---------- dataset importers ----------

const peopleSchema = z.object({
  email: z.string().email('must be a valid email'),
  role: z.string().min(1, 'is required'),
  first_name: z.string().optional().default(''),
  last_name: z.string().optional().default(''),
  phone: z.string().optional().default(''),
})

const VALID_ROLES = ['admin', 'manager', 'employee', 'tenant', 'owner', 'vendor']

async function importPeople(ctx: Ctx, records: Record<string, string>[]): Promise<ImportResult> {
  const existing = await loadPeopleByEmail(ctx)
  const errors: ImportRowError[] = []
  let skipped = 0
  const toInsert: { line: number; record: Record<string, unknown> }[] = []
  const seenEmails = new Set<string>()

  records.forEach((rec, i) => {
    const line = i + 2
    const parsed = peopleSchema.safeParse(rec)
    if (!parsed.success) return void errors.push({ line, message: firstIssue(parsed.error) })
    const d = parsed.data
    const emailKey = normKey(d.email)
    if (existing.has(emailKey) || seenEmails.has(emailKey)) return void skipped++
    const roles = d.role
      .split(/[|;,]/)
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean)
    const bad = roles.filter((r) => !VALID_ROLES.includes(r))
    if (roles.length === 0 || bad.length > 0) {
      return void errors.push({
        line,
        message: `role "${d.role}" is invalid — use ${VALID_ROLES.join(', ')}`,
      })
    }
    seenEmails.add(emailKey)
    toInsert.push({
      line,
      record: {
        org_id: ctx.person.org_id,
        email: d.email.trim(),
        role: roles,
        first_name: d.first_name || null,
        last_name: d.last_name || null,
        phone: d.phone || null,
        active: true,
      },
    })
  })

  const inserted = await chunkedInsert(ctx, 'people', toInsert, errors)
  return { success: true, inserted, skipped, errors }
}

const portfolioSchema = z.object({
  name: z.string().min(1, 'is required'),
  owner_email: z.string().optional().default(''),
})

async function importPortfolios(ctx: Ctx, records: Record<string, string>[]): Promise<ImportResult> {
  const [people, existing] = await Promise.all([loadPeopleByEmail(ctx), loadPortfoliosByName(ctx)])
  const errors: ImportRowError[] = []
  let skipped = 0
  const toInsert: { line: number; record: Record<string, unknown> }[] = []
  const seen = new Set<string>()

  records.forEach((rec, i) => {
    const line = i + 2
    const parsed = portfolioSchema.safeParse(rec)
    if (!parsed.success) return void errors.push({ line, message: firstIssue(parsed.error) })
    const d = parsed.data
    const nameKey = normKey(d.name)
    if (existing.has(nameKey) || seen.has(nameKey)) return void skipped++
    let ownerId: string | null = null
    if (d.owner_email) {
      const owner = people.get(normKey(d.owner_email))
      if (!owner) {
        return void errors.push({
          line,
          message: `owner_email "${d.owner_email}" does not match anyone — import People first`,
        })
      }
      ownerId = owner.id
    }
    seen.add(nameKey)
    toInsert.push({
      line,
      record: { org_id: ctx.person.org_id, name: d.name.trim(), owner_id: ownerId },
    })
  })

  const inserted = await chunkedInsert(ctx, 'portfolios', toInsert, errors)
  return { success: true, inserted, skipped, errors }
}

const PROPERTY_TYPES = ['house', 'duplex', 'apartment_building', 'condo', 'townhouse', 'other']
const UNIT_STATUSES = ['vacant', 'occupied', 'maintenance']

const propertySchema = z.object({
  street_address: z.string().min(1, 'is required'),
  city: z.string().min(1, 'is required'),
  province: z.string().min(1, 'is required'),
  postal_code: z.string().optional().default(''),
  property_type: z.string().optional().default(''),
  portfolio_name: z.string().optional().default(''),
  owner_email: z.string().optional().default(''),
  unit_number: z.string().optional().default(''),
  bedrooms: z.string().optional().default(''),
  bathrooms: z.string().optional().default(''),
  sq_footage: z.string().optional().default(''),
  status: z.string().optional().default(''),
  asking_rent: z.string().optional().default(''),
  management_fee_type: z.string().optional().default(''),
  management_fee_value: z.string().optional().default(''),
})

async function importProperties(ctx: Ctx, records: Record<string, string>[]): Promise<ImportResult> {
  const [people, portfolios, unitsByAddress] = await Promise.all([
    loadPeopleByEmail(ctx),
    loadPortfoliosByName(ctx),
    loadUnitsByAddress(ctx),
  ])

  // Existing properties by "address|city" so re-imports reuse the property row.
  const { data: propRows } = await ctx.supabase
    .from('properties')
    .select('id, street_address, city')
    .eq('org_id', ctx.person.org_id)
  const existingProps = new Map<string, string>()
  for (const p of propRows ?? []) {
    existingProps.set(normKey(p.street_address) + '|' + normKey(p.city ?? ''), p.id)
  }

  const errors: ImportRowError[] = []
  let skipped = 0
  let inserted = 0
  const numOrNull = (s: string) => {
    if (!s) return null
    const n = Number(s.replace(/[$,\s]/g, ''))
    return Number.isNaN(n) ? NaN : n
  }

  // Validate all rows first, grouped by property.
  type UnitRow = { line: number; d: z.infer<typeof propertySchema> }
  const groups = new Map<string, UnitRow[]>()
  records.forEach((rec, i) => {
    const line = i + 2
    const parsed = propertySchema.safeParse(rec)
    if (!parsed.success) return void errors.push({ line, message: firstIssue(parsed.error) })
    const d = parsed.data
    if (d.property_type && !PROPERTY_TYPES.includes(d.property_type.toLowerCase())) {
      return void errors.push({ line, message: `property_type "${d.property_type}" is invalid — use ${PROPERTY_TYPES.join(', ')}` })
    }
    if (d.status && !UNIT_STATUSES.includes(d.status.toLowerCase())) {
      return void errors.push({ line, message: `status "${d.status}" is invalid — use ${UNIT_STATUSES.join(', ')}` })
    }
    if (d.management_fee_type && !['percent', 'flat'].includes(d.management_fee_type.toLowerCase())) {
      return void errors.push({ line, message: `management_fee_type "${d.management_fee_type}" is invalid — use percent or flat` })
    }
    for (const [field, value] of [
      ['bedrooms', d.bedrooms],
      ['bathrooms', d.bathrooms],
      ['sq_footage', d.sq_footage],
      ['asking_rent', d.asking_rent],
      ['management_fee_value', d.management_fee_value],
    ] as const) {
      if (Number.isNaN(numOrNull(value))) {
        return void errors.push({ line, message: `${field} "${value}" is not a number` })
      }
    }
    if (d.portfolio_name && !portfolios.has(normKey(d.portfolio_name))) {
      return void errors.push({ line, message: `portfolio_name "${d.portfolio_name}" does not match any portfolio — import Portfolios first` })
    }
    if (d.owner_email && !people.has(normKey(d.owner_email))) {
      return void errors.push({ line, message: `owner_email "${d.owner_email}" does not match anyone — import People first` })
    }
    const key = normKey(d.street_address) + '|' + normKey(d.city)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push({ line, d })
  })

  for (const [key, rows] of groups) {
    const first = rows[0].d
    let propertyId = existingProps.get(key)
    if (!propertyId) {
      const { data: created, error } = await ctx.supabase
        .from('properties')
        .insert({
          org_id: ctx.person.org_id,
          street_address: first.street_address.trim(),
          city: first.city.trim(),
          province: first.province.trim(),
          postal_code: first.postal_code || null,
          property_type: (first.property_type || 'house').toLowerCase() as
            | 'house' | 'duplex' | 'apartment_building' | 'condo' | 'townhouse' | 'other',
          portfolio_id: first.portfolio_name ? portfolios.get(normKey(first.portfolio_name)) : null,
          owner_id: first.owner_email ? people.get(normKey(first.owner_email))!.id : null,
          management_fee_type: first.management_fee_type ? first.management_fee_type.toLowerCase() : null,
          management_fee_value: numOrNull(first.management_fee_value),
        })
        .select('id')
        .single()
      if (error || !created) {
        console.error('[importCsv:properties]', error)
        rows.forEach((r) => errors.push({ line: r.line, message: friendlyDbError(error?.message ?? 'insert failed') }))
        continue
      }
      propertyId = created.id
      existingProps.set(key, propertyId!)
    }

    const existingUnits = new Set(
      (unitsByAddress.get(normKey(first.street_address)) ?? [])
        .filter((u) => u.propertyId === propertyId)
        .map((u) => u.unitNumber)
    )
    const unitRows: { line: number; record: Record<string, unknown> }[] = []
    for (const { line, d } of rows) {
      const un = normKey(d.unit_number)
      if (existingUnits.has(un)) {
        skipped++
        continue
      }
      existingUnits.add(un)
      unitRows.push({
        line,
        record: {
          org_id: ctx.person.org_id,
          property_id: propertyId,
          unit_number: d.unit_number || null,
          bedrooms: numOrNull(d.bedrooms) ?? 1,
          bathrooms: numOrNull(d.bathrooms) ?? 1,
          sq_footage: numOrNull(d.sq_footage),
          status: (d.status || 'vacant').toLowerCase(),
          asking_rent: numOrNull(d.asking_rent),
        },
      })
    }
    inserted += await chunkedInsert(ctx, 'units', unitRows, errors)
  }

  return { success: true, inserted, skipped, errors }
}

const leaseSchema = z.object({
  property_address: z.string().min(1, 'is required'),
  unit_number: z.string().optional().default(''),
  tenant_email: z.string().email('must be a valid email'),
  start_date: dateStr,
  end_date: dateStr,
  monthly_rent: moneyStr('monthly_rent'),
  deposit_amount: z.preprocess(
    (v) => (String(v ?? '').trim() === '' ? '0' : String(v).replace(/[$,\s]/g, '')),
    z.coerce.number().nonnegative('deposit_amount must be a number')
  ),
  rent_due_day: z.preprocess(
    (v) => (String(v ?? '').trim() === '' ? '1' : v),
    z.coerce.number().int().min(1, 'rent_due_day must be 1-28').max(28, 'rent_due_day must be 1-28')
  ),
  status: z.string().optional().default(''),
})

async function importLeases(ctx: Ctx, records: Record<string, string>[]): Promise<ImportResult> {
  const [people, unitsByAddress] = await Promise.all([loadPeopleByEmail(ctx), loadUnitsByAddress(ctx)])
  const { data: leaseRows } = await ctx.supabase
    .from('leases')
    .select('unit_id, tenant_id, start_date')
    .eq('org_id', ctx.person.org_id)
  const existing = new Set((leaseRows ?? []).map((l) => `${l.unit_id}|${l.tenant_id}|${l.start_date}`))

  const errors: ImportRowError[] = []
  let skipped = 0
  const toInsert: { line: number; record: Record<string, unknown> }[] = []

  records.forEach((rec, i) => {
    const line = i + 2
    const parsed = leaseSchema.safeParse(rec)
    if (!parsed.success) return void errors.push({ line, message: firstIssue(parsed.error) })
    const d = parsed.data
    if (d.status && !['active', 'expired', 'terminated'].includes(d.status.toLowerCase())) {
      return void errors.push({ line, message: `status "${d.status}" is invalid — use active, expired or terminated` })
    }
    if (d.end_date <= d.start_date) {
      return void errors.push({ line, message: 'end_date must be after start_date' })
    }
    const tenant = people.get(normKey(d.tenant_email))
    if (!tenant) {
      return void errors.push({ line, message: `tenant_email "${d.tenant_email}" does not match anyone — import People first` })
    }
    const { unit, error } = resolveUnit(unitsByAddress, d.property_address, d.unit_number)
    if (!unit) return void errors.push({ line, message: error! })
    const dupKey = `${unit.unitId}|${tenant.id}|${d.start_date}`
    if (existing.has(dupKey)) return void skipped++
    existing.add(dupKey)
    toInsert.push({
      line,
      record: {
        org_id: ctx.person.org_id,
        unit_id: unit.unitId,
        tenant_id: tenant.id,
        start_date: d.start_date,
        end_date: d.end_date,
        monthly_rent: d.monthly_rent,
        deposit_amount: d.deposit_amount,
        rent_due_day: d.rent_due_day,
        status: (d.status || 'active').toLowerCase(),
      },
    })
  })

  const inserted = await chunkedInsert(ctx, 'leases', toInsert, errors)
  return { success: true, inserted, skipped, errors }
}

const PAYMENT_METHODS = ['stripe', 'etransfer', 'cheque', 'cash', 'bank_transfer']
const PAYMENT_STATUSES = ['recorded', 'pending_clearance', 'cleared']

const paymentSchema = z.object({
  property_address: z.string().min(1, 'is required'),
  unit_number: z.string().optional().default(''),
  date: dateStr,
  amount: moneyStr('amount').refine((n) => n > 0, 'amount must be positive'),
  method: z.string().optional().default(''),
  status: z.string().optional().default(''),
  notes: z.string().optional().default(''),
})

async function importPayments(ctx: Ctx, records: Record<string, string>[]): Promise<ImportResult> {
  const unitsByAddress = await loadUnitsByAddress(ctx)
  const { data: leaseRows } = await ctx.supabase
    .from('leases')
    .select('id, unit_id, start_date, end_date')
    .eq('org_id', ctx.person.org_id)
  const leasesByUnit = new Map<string, { id: string; start: string; end: string }[]>()
  for (const l of leaseRows ?? []) {
    if (!leasesByUnit.has(l.unit_id)) leasesByUnit.set(l.unit_id, [])
    leasesByUnit.get(l.unit_id)!.push({ id: l.id, start: l.start_date, end: l.end_date })
  }

  const errors: ImportRowError[] = []
  const toInsert: { line: number; record: Record<string, unknown> }[] = []

  records.forEach((rec, i) => {
    const line = i + 2
    const parsed = paymentSchema.safeParse(rec)
    if (!parsed.success) return void errors.push({ line, message: firstIssue(parsed.error) })
    const d = parsed.data
    if (d.method && !PAYMENT_METHODS.includes(d.method.toLowerCase())) {
      return void errors.push({ line, message: `method "${d.method}" is invalid — use ${PAYMENT_METHODS.join(', ')}` })
    }
    if (d.status && !PAYMENT_STATUSES.includes(d.status.toLowerCase())) {
      return void errors.push({ line, message: `status "${d.status}" is invalid — use ${PAYMENT_STATUSES.join(', ')}` })
    }
    const { unit, error } = resolveUnit(unitsByAddress, d.property_address, d.unit_number)
    if (!unit) return void errors.push({ line, message: error! })
    const leases = leasesByUnit.get(unit.unitId) ?? []
    if (leases.length === 0) {
      return void errors.push({ line, message: `no lease found on "${d.property_address}" — import Leases first` })
    }
    const covering = leases.find((l) => l.start <= d.date && d.date <= l.end)
    const lease = covering ?? [...leases].sort((a, b) => (a.end < b.end ? 1 : -1))[0]
    const status = (d.status || 'recorded').toLowerCase()
    toInsert.push({
      line,
      record: {
        org_id: ctx.person.org_id,
        lease_id: lease.id,
        amount: d.amount,
        method: (d.method || 'etransfer').toLowerCase(),
        status,
        cleared_at: status === 'cleared' ? d.date + 'T12:00:00Z' : null,
        notes: d.notes || null,
        recorded_by: ctx.person.id,
        created_at: d.date + 'T12:00:00Z',
      },
    })
  })

  const inserted = await chunkedInsert(ctx, 'payments', toInsert, errors)
  return { success: true, inserted, skipped: 0, errors }
}

const WO_PRIORITIES = ['low', 'medium', 'high', 'urgent']
const WO_STATUSES = ['draft', 'submitted', 'assigned', 'in_progress', 'pending_approval', 'approved', 'completed', 'closed']

const projectSchema = z.object({
  property_address: z.string().min(1, 'is required'),
  unit_number: z.string().optional().default(''),
  title: z.string().min(1, 'is required'),
  description: z.string().min(1, 'is required'),
  priority: z.string().optional().default(''),
  status: z.string().optional().default(''),
  vendor_email: z.string().optional().default(''),
  estimated_cost: z.string().optional().default(''),
})

async function importProjects(ctx: Ctx, records: Record<string, string>[]): Promise<ImportResult> {
  const [people, unitsByAddress] = await Promise.all([loadPeopleByEmail(ctx), loadUnitsByAddress(ctx)])

  const errors: ImportRowError[] = []
  const toInsert: { line: number; record: Record<string, unknown> }[] = []

  records.forEach((rec, i) => {
    const line = i + 2
    const parsed = projectSchema.safeParse(rec)
    if (!parsed.success) return void errors.push({ line, message: firstIssue(parsed.error) })
    const d = parsed.data
    if (d.priority && !WO_PRIORITIES.includes(d.priority.toLowerCase())) {
      return void errors.push({ line, message: `priority "${d.priority}" is invalid — use ${WO_PRIORITIES.join(', ')}` })
    }
    if (d.status && !WO_STATUSES.includes(d.status.toLowerCase())) {
      return void errors.push({ line, message: `status "${d.status}" is invalid — use ${WO_STATUSES.join(', ')}` })
    }
    const cost = d.estimated_cost ? Number(d.estimated_cost.replace(/[$,\s]/g, '')) : null
    if (cost !== null && Number.isNaN(cost)) {
      return void errors.push({ line, message: `estimated_cost "${d.estimated_cost}" is not a number` })
    }
    let vendorId: string | null = null
    if (d.vendor_email) {
      const vendor = people.get(normKey(d.vendor_email))
      if (!vendor) {
        return void errors.push({ line, message: `vendor_email "${d.vendor_email}" does not match anyone — import People first` })
      }
      vendorId = vendor.id
    }
    const { unit, error } = resolveUnit(unitsByAddress, d.property_address, d.unit_number)
    if (!unit) return void errors.push({ line, message: error! })
    toInsert.push({
      line,
      record: {
        org_id: ctx.person.org_id,
        property_id: unit.propertyId,
        unit_id: d.unit_number ? unit.unitId : null,
        title: d.title.trim(),
        description: d.description.trim(),
        priority: (d.priority || 'medium').toLowerCase(),
        status: (d.status || 'submitted').toLowerCase(),
        assigned_vendor_id: vendorId,
        estimated_cost: cost,
        created_by: ctx.person.id,
      },
    })
  })

  const inserted = await chunkedInsert(ctx, 'work_orders', toInsert, errors)
  return { success: true, inserted, skipped: 0, errors }
}

// ---------- entry point ----------

export async function importCsv(dataset: ImportDataset, csvText: string): Promise<ImportResult> {
  const ctx = await getStaffContext()
  if (!ctx) return { success: false, error: 'Only managers and admins can import data.' }

  const parsed = parseCsvForDataset(dataset, csvText)
  if (parsed.records.length === 0) {
    return { success: false, error: 'No data rows found — the file needs a header row plus at least one row.' }
  }
  if (parsed.missingRequired.length > 0) {
    return {
      success: false,
      error: `Missing required column(s): ${parsed.missingRequired.join(', ')}. Download the template to get the expected header.`,
    }
  }
  if (parsed.records.length > MAX_ROWS) {
    return { success: false, error: `Too many rows (${parsed.records.length}) — the limit is ${MAX_ROWS} per import.` }
  }

  let result: ImportResult
  switch (dataset) {
    case 'people':
      result = await importPeople(ctx, parsed.records)
      break
    case 'portfolios':
      result = await importPortfolios(ctx, parsed.records)
      break
    case 'properties':
      result = await importProperties(ctx, parsed.records)
      break
    case 'leases':
      result = await importLeases(ctx, parsed.records)
      break
    case 'payments':
      result = await importPayments(ctx, parsed.records)
      break
    case 'projects':
      result = await importProjects(ctx, parsed.records)
      break
    default:
      return { success: false, error: 'Unknown dataset.' }
  }

  if (result.success && result.inserted > 0) revalidatePath('/app')
  return result
}
