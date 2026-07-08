// src/lib/canary/import-specs.ts
// Shared definitions for the bulk CSV importer: dataset column specs,
// template generation, and a small quote-aware CSV parser.
// Used by both the client UI (template download, preview) and the
// server action (validation + insert).

export type ImportDataset =
  | 'people'
  | 'portfolios'
  | 'properties'
  | 'leases'
  | 'payments'
  | 'projects'

export interface ImportColumn {
  key: string
  required?: boolean
  note: string
  example: string
  /** alternate header names (normalized) that map onto this column, e.g. AppSheet exports */
  aliases?: string[]
}

export interface ImportSpec {
  key: ImportDataset
  label: string
  description: string
  columns: ImportColumn[]
  /** Two sample rows used in the downloadable template */
  samples: string[][]
}

export const IMPORT_SPECS: Record<ImportDataset, ImportSpec> = {
  people: {
    key: 'people',
    label: 'People',
    description:
      'Contacts: owners (clients), tenants and inquiries, vendors, realtors, accountants, and staff. Existing emails are skipped. AppSheet export headers (Name, Address, Minimum Bedrooms, …) are recognized automatically. Tenant-preference columns only apply to tenants.',
    columns: [
      { key: 'email', required: true, note: 'Unique per person', example: 'jane@example.com' },
      { key: 'role', required: true, note: 'tenant, owner (or client), vendor (or cleaner), realtor, accountant, contact, manager, employee — combine with |', example: 'tenant' },
      { key: 'first_name', note: 'Or provide a single "name" column instead', example: 'Jane' },
      { key: 'last_name', note: '', example: 'Doe' },
      { key: 'name', note: 'Full name — used when first/last name are blank', example: 'Jane Doe' },
      { key: 'phone', note: '', example: '709-555-0142' },
      { key: 'company', note: 'Vendor / business name', example: 'BuildCo Ltd' },
      { key: 'mailing_address', note: 'Billing / legal address', example: '10 Main St, St. John\u2019s, NL', aliases: ['address'] },
      { key: 'status', note: 'Lifecycle, e.g. New Inquiry, Still Searching, Current Tenant, Past Client', example: 'New Inquiry' },
      { key: 'website', note: '', example: 'https://buildco.ca' },
      { key: 'services', note: 'Vendor services', example: 'Cleaning' },
      { key: 'rating', note: 'Internal vendor rating 0-5', example: '4' },
      { key: 'notes', note: 'Free-form notes', example: 'Only servicing east end', aliases: ['other_details'] },
      { key: 'min_bedrooms', note: 'Tenants only — inquiry preference', example: '2', aliases: ['minimum_bedrooms'] },
      { key: 'min_bathrooms', note: 'Tenants only', example: '1', aliases: ['minimum_bathrooms'] },
      { key: 'min_parking', note: 'Tenants only', example: '1', aliases: ['minimum_parking_spots'] },
      { key: 'pets', note: 'Tenants only, e.g. Cat Friendly, None', example: 'Cat Friendly' },
      { key: 'move_in_date', note: 'Tenants only — YYYY-MM-DD', example: '2026-09-01', aliases: ['move_in', 'movein_date'] },
      { key: 'lease_type', note: 'Tenants only, e.g. Long Term (12+ months)', example: 'Long Term (12+ months)' },
      { key: 'max_price', note: 'Tenants only — max monthly budget', example: '1800' },
    ],
    samples: [
      ['jane@example.com', 'tenant', 'Jane', 'Doe', '', '709-555-0142', '', '', 'New Inquiry', '', '', '', 'Looking near downtown', '2', '1', '1', 'Cat Friendly', '2026-09-01', 'Long Term (12+ months)', '1800'],
      ['bob@buildco.ca', 'vendor', 'Bob', 'Smith', '', '709-555-0987', 'BuildCo Ltd', '10 Main St, St. John\u2019s, NL', '', 'https://buildco.ca', 'Plumbing', '4', '', '', '', '', '', '', '', ''],
    ],
  },
  portfolios: {
    key: 'portfolios',
    label: 'Portfolios',
    description:
      'Groups of properties, usually one per owner or ownership company. Existing portfolio names are skipped.',
    columns: [
      { key: 'name', required: true, note: 'Unique portfolio name', example: 'Harbourview Holdings' },
      { key: 'owner_email', note: 'Must match a person imported with the owner role', example: 'owner@example.com' },
    ],
    samples: [
      ['Harbourview Holdings', 'owner@example.com'],
      ['Duckworth Rentals', ''],
    ],
  },
  properties: {
    key: 'properties',
    label: 'Properties & Units',
    description:
      'One row per unit. Rows sharing the same street address + city are grouped into a single property with multiple units. Duplicate units are skipped. AppSheet/Canary labels (Leased, Archived, Airbnb, single family, 10%, …) are normalized automatically — see PROPERTY_STATUS_ALIASES and PROPERTY_TYPE_ALIASES.',
    columns: [
      { key: 'street_address', required: true, note: '', example: '12 Duckworth St' },
      { key: 'city', required: true, note: '', example: "St. John's" },
      { key: 'province', required: true, note: '', example: 'NL' },
      { key: 'postal_code', note: '', example: 'A1C 1G4' },
      { key: 'property_type', note: 'house, duplex, apartment_building, condo, townhouse or other — AppSheet: single family → house, multi-unit → apartment_building, commercial → other', example: 'house' },
      { key: 'portfolio_name', note: 'Matches portfolio by exact name or AppSheet short name (e.g. "Schwartz & Cooke" → "Schwartz & Cooke - slug"). Import Portfolios first; unmatched names import with no portfolio link.', example: 'Harbourview Holdings' },
      { key: 'owner_email', note: 'Must match an existing person with the owner role', example: 'owner@example.com' },
      { key: 'unit_number', note: 'Leave blank for single-unit properties', example: '2B' },
      { key: 'bedrooms', note: 'Whole number, defaults to 1', example: '2' },
      { key: 'bathrooms', note: 'Number, defaults to 1 (1.5 allowed)', example: '1.5' },
      { key: 'sq_footage', note: 'Whole number', example: '850' },
      { key: 'status', note: 'vacant, occupied or maintenance — AppSheet: Leased→occupied, Archived→archived_at set, Airbnb→vacant, Project→maintenance', example: 'vacant' },
      { key: 'asking_rent', note: 'Monthly asking rent (numbers only)', example: '1600' },
      { key: 'management_fee_type', note: 'percent or flat', example: 'percent' },
      { key: 'management_fee_value', note: 'e.g. 10, 10%, or $150 — % and $ symbols stripped', example: '10' },
    ],
    samples: [
      ['12 Duckworth St', "St. John's", 'NL', 'A1C 1G4', 'duplex', 'Harbourview Holdings', 'owner@example.com', '1', '2', '1', '850', 'occupied', '1600', 'percent', '10'],
      ['12 Duckworth St', "St. John's", 'NL', 'A1C 1G4', 'duplex', 'Harbourview Holdings', 'owner@example.com', '2', '1', '1', '600', 'vacant', '1200', 'percent', '10'],
    ],
  },
  leases: {
    key: 'leases',
    label: 'Leases',
    description:
      'One row per lease. Import Properties first; People optional (tenants can be linked later in the lease editor). AppSheet export headers (Property, Rent, Lease Start Date, Tenants, Editors, …) are recognized automatically. tenant_email is optional — when absent, tenant_id is left blank and appsheet_tenant_ids / tenant_contacts_raw (Editors) are stored for later linking. property_address may be a full AppSheet line (street, city, province, postal, country) — matched to imported properties via canonical street + city (see LEASE_STATUS_ALIASES for status labels). Duplicate rows (same appsheet_unique_id, or same unit + tenant + start date) are skipped.',
    columns: [
      { key: 'property_address', required: true, note: 'Full or street address of an imported property', example: "21 Hercules Pl, St. John's, NL", aliases: ['property'] },
      { key: 'unit_number', note: 'Required when the property has multiple units', example: '2B' },
      {
        key: 'tenant_email',
        note: 'Optional — primary tenant email; when provided must match an imported person. Leave blank when using AppSheet Tenants/Editors columns only.',
        example: 'jane@example.com',
      },
      {
        key: 'tenant_contacts_raw',
        note: 'Optional — AppSheet Editors column (Name: phone: email). Used to resolve tenant_id when email matches People; always stored on the lease row.',
        example: "Jane Doe: 709-555-0142: jane@example.com",
        aliases: ['editors'],
      },
      { key: 'start_date', required: true, note: 'YYYY-MM-DD or M/D/YYYY', example: '2019-06-01', aliases: ['lease_start_date'] },
      { key: 'end_date', note: 'YYYY-MM-DD — leave blank for month-to-month', example: '2020-05-30', aliases: ['lease_end_date'] },
      { key: 'lease_term_type', note: 'fixed_term or month_to_month — inferred from blank end_date when omitted', example: 'month_to_month', aliases: ['term_type'] },
      { key: 'monthly_rent', required: true, note: 'Numbers only (currency symbols stripped)', example: '1450', aliases: ['rent'] },
      { key: 'utilities_included', note: 'Tenant-facing — e.g. Not Included, Internet Included', example: 'Not Included', aliases: ['utilities'] },
      { key: 'management_start_date', note: 'Internal — YYYY-MM-DD', example: '2019-06-01' },
      { key: 'management_end_date', note: 'Internal — YYYY-MM-DD', example: '2020-05-30' },
      { key: 'management_fee_percent', note: 'Internal — percent without symbol, e.g. 12 for 12%', example: '12', aliases: ['management_fee'] },
      { key: 'rental_credit', note: 'Tenant-facing — dollar amount', example: '100' },
      { key: 'rental_credit_expiry', note: 'Tenant-facing — YYYY-MM-DD', example: '2025-02-18', aliases: ['credit_expiry_date'] },
      { key: 'days_occupied', note: 'Internal — imported as-is from AppSheet', example: '365' },
      { key: 'insurance_details', note: 'Tenant-facing — free text', example: '' },
      { key: 'insurance_required', note: 'Tenant-facing — TRUE/FALSE', example: 'TRUE' },
      { key: 'insurance_confirmed', note: 'Tenant-facing — TRUE/FALSE', example: 'FALSE' },
      { key: 'policy_expires', note: 'Tenant-facing — YYYY-MM-DD', example: '' },
      { key: 'status', note: 'active, expired or terminated — AppSheet/Canary: Expiring/Upcoming/Listed/Leased→active, Expired/Past→expired, Evicted/Terminated/Cancelled→terminated; blank→derived from end_date', example: 'expired' },
      { key: 'termination_reason', note: 'Internal — e.g. Terminated by Tenant, Month to month', example: 'Terminated by Tenant', aliases: ['reason'] },
      { key: 'documents', note: 'Internal — document references from AppSheet', example: '' },
      { key: 'notes', note: 'Free-form notes', example: '' },
      { key: 'lease_months', note: 'Stored month count (computed if blank)', example: '11', aliases: ['months'] },
      {
        key: 'appsheet_tenant_ids',
        note: 'Optional — AppSheet Tenants column (comma-separated IDs). Resolves tenant_id when people.appsheet_id exists; always stored on the lease row.',
        example: 'fdt8cgft360, fdt8cgft359',
        aliases: ['tenants'],
      },
      { key: 'appsheet_viewer_ids', note: 'Internal — AppSheet Viewers column', example: 'fdt8cgft75, fdt8cgft267', aliases: ['viewers'] },
      { key: 'appsheet_unique_id', note: 'Internal — AppSheet Unique ID for idempotent import', example: "6/1/2019 / 5/30/2020 / 21 Hercules Pl...", aliases: ['unique_id'] },
      { key: 'portfolio_appsheet_id', note: 'Internal — AppSheet Portfolio ID slug', example: 'Hickey & Esau - 2asglkrw', aliases: ['portfolio_id'] },
      { key: 'pets_policy', note: 'Tenant-facing — e.g. By Approval', example: 'By Approval', aliases: ['pets'] },
      { key: 'leasing_fee_percent', note: 'Internal — percent without symbol', example: '50', aliases: ['leasing_fee'] },
      { key: 'appsheet_created_at', note: 'Internal — original AppSheet Timestamp', example: '1/29/2026 1:43:23', aliases: ['timestamp'] },
      { key: 'appsheet_modified_at', note: 'Internal — AppSheet Last Modified', example: '9/22/2025 0:19:07', aliases: ['last_modified'] },
      { key: 'bedrooms', note: 'Snapshot at lease time', example: '3' },
      { key: 'bathrooms', note: 'Snapshot at lease time', example: '2.0' },
      { key: 'parking_spots', note: 'Snapshot at lease time', example: '2', aliases: ['parking'] },
      { key: 'folder_id', note: 'Internal — Google Drive folder ID', example: '' },
      { key: 'previous_lease_appsheet_id', note: 'Internal — AppSheet Previous Lease ID (resolved to FK after import)', example: '', aliases: ['previous_lease_id'] },
      { key: 'deposit_amount', note: 'Defaults to 0', example: '800' },
      { key: 'rent_due_day', note: '1–28, defaults to 1', example: '1' },
    ],
    samples: [
      ["21 Hercules Pl, St. John's, NL", '', '', "Catherine Hickey: 709 351 4282: drcatherinehickey@gmail.com, Darren Esau: 709 746 2314: darren@esan.ca", '2019-06-01', '2020-05-30', '1450', 'Not Included', '2019-06-01', '2020-05-30', '12', '', '', '365', '', 'TRUE', 'FALSE', '', 'expired', '', '', '', '11', 'fdt8cgft360, fdt8cgft359', 'fdt8cgft75, fdt8cgft267', "6/1/2019 / 5/30/2020 / 21 Hercules Pl", 'Hickey & Esau - 2asglkrw', '', '50', '1/29/2026 1:43:23', '9/22/2025 0:19:07', '3', '2.0', '2', '', '', '0', '1'],
      ["25 A Cochrane St, St. John's, NL", '', 'lauramadonnamurray@gmail.com', 'Laura Murray: 61481973157: lauramadonnamurray@gmail.com', '2021-05-01', '2025-12-31', '950', 'Internet Included', '2021-05-01', '2025-12-31', '10', '', '2/18/2025', '1706', '', 'TRUE', '', '', 'expired', 'Terminated by Tenant', '', '', '55', '', 'fdt8cgft75, fdt8cgft267', "5/1/2021 / 12/31/2025 / 25 A Cochrane St", 'Laura Murray - pz0h7usq', '', '50', '4/28/2026 17:04:52', '', '1', '1.0', '2', '', '', '0', '1'],
    ],
  },
  payments: {
    key: 'payments',
    label: 'Payments',
    description:
      'Rent payments recorded against a lease. The unit is matched by address, then the lease covering the payment date (or the most recent one) is used.',
    columns: [
      { key: 'property_address', required: true, note: 'Street address of an imported property', example: '12 Duckworth St' },
      { key: 'unit_number', note: 'Required when the property has multiple units', example: '2B' },
      { key: 'date', required: true, note: 'YYYY-MM-DD', example: '2026-07-01' },
      { key: 'amount', required: true, note: 'Numbers only, positive', example: '1600' },
      { key: 'method', note: 'stripe, etransfer, cheque, cash or bank_transfer — defaults to etransfer', example: 'etransfer' },
      { key: 'status', note: 'recorded, pending_clearance or cleared — defaults to recorded', example: 'recorded' },
      { key: 'notes', note: '', example: 'July rent' },
    ],
    samples: [
      ['12 Duckworth St', '1', '2026-07-01', '1600', 'etransfer', 'recorded', 'July rent'],
      ['45 Gower St', '', '2026-07-02', '1450', 'cheque', 'cleared', ''],
    ],
  },
  projects: {
    key: 'projects',
    label: 'Projects',
    description:
      'Maintenance projects / work orders. The property must already exist. Vendors are matched by email.',
    columns: [
      { key: 'property_address', required: true, note: 'Street address of an imported property', example: '12 Duckworth St' },
      { key: 'unit_number', note: 'Optional unit on the property', example: '2B' },
      { key: 'title', required: true, note: '', example: 'Replace bathroom fan' },
      { key: 'description', required: true, note: '', example: 'Fan is noisy and no longer venting.' },
      { key: 'priority', note: 'low, medium, high or urgent — defaults to medium', example: 'medium' },
      { key: 'status', note: 'draft, submitted, assigned, in_progress, pending_approval, approved, completed or closed — defaults to submitted', example: 'submitted' },
      { key: 'vendor_email', note: 'Must match an imported person with the vendor role', example: 'bob@buildco.ca' },
      { key: 'estimated_cost', note: 'Numbers only', example: '350' },
    ],
    samples: [
      ['12 Duckworth St', '1', 'Replace bathroom fan', 'Fan is noisy and no longer venting.', 'medium', 'submitted', 'bob@buildco.ca', '350'],
      ['45 Gower St', '', 'Paint front door', 'Peeling paint, needs scrape + 2 coats.', 'low', 'draft', '', '150'],
    ],
  },
}

export const IMPORT_ORDER: ImportDataset[] = [
  'people',
  'portfolios',
  'properties',
  'leases',
  'payments',
  'projects',
]

// ---------- AppSheet / Canary value aliases (properties import) ----------

/** AppSheet / Canary UI status labels → units.status (DB check constraint). */
export const PROPERTY_STATUS_ALIASES: Record<string, 'vacant' | 'occupied' | 'maintenance'> = {
  vacant: 'vacant',
  leased: 'occupied',
  occupied: 'occupied',
  maintenance: 'maintenance',
  /** Offboarded / inactive — no active lease in PropOS. */
  archived: 'vacant',
  /** STR inventory; stored as vacant in LTR sense (Airbnb chip comes from Hospitable link). */
  airbnb: 'vacant',
  /** Renovation or capital project in progress. */
  project: 'maintenance',
  /** Manager office / non-residential — treat as not leased. */
  office: 'vacant',
}

/** AppSheet / bulk-template type labels → properties.property_type enum. */
export const PROPERTY_TYPE_ALIASES: Record<string, string> = {
  house: 'house',
  duplex: 'duplex',
  apartment_building: 'apartment_building',
  condo: 'condo',
  townhouse: 'townhouse',
  other: 'other',
  'single family': 'house',
  'single-family': 'house',
  single: 'house',
  'multi unit': 'apartment_building',
  'multi-unit': 'apartment_building',
  multiunit: 'apartment_building',
  apartment: 'apartment_building',
  commercial: 'other',
}

function aliasLookupKeys(raw: string): string[] {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return []
  const spaced = trimmed.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  const underscored = spaced.replace(/\s+/g, '_')
  return [...new Set([trimmed, spaced, underscored])]
}

/** Map AppSheet/Canary status label to DB units.status value. Empty → ''. */
export function normalizePropertyStatus(raw: string): string {
  for (const key of aliasLookupKeys(raw)) {
    const mapped = PROPERTY_STATUS_ALIASES[key]
    if (mapped) return mapped
  }
  return raw.trim().toLowerCase()
}

/** Map AppSheet/Canary property type label to DB property_type enum. Empty → ''. */
export function normalizePropertyType(raw: string): string {
  for (const key of aliasLookupKeys(raw)) {
    const mapped = PROPERTY_TYPE_ALIASES[key]
    if (mapped) return mapped
  }
  const fallback = aliasLookupKeys(raw).at(-1) ?? ''
  return fallback.replace(/\s+/g, '_')
}

/** Strip %, $, commas and parse management fee — returns NaN when not numeric. */
export function parseManagementFeeValue(raw: string): number | null {
  if (!raw.trim()) return null
  const n = Number(raw.trim().replace(/%/g, '').replace(/[$,\s]/g, ''))
  return Number.isNaN(n) ? NaN : n
}

/** True when the raw AppSheet/Canary status means the unit should be archived on import. */
export function isPropertyStatusArchived(raw: string): boolean {
  for (const key of aliasLookupKeys(raw)) {
    if (key === 'archived') return true
  }
  return false
}

/** Normalize AppSheet-friendly property row values before validation/insert. */
export function normalizePropertyImportRow(row: Record<string, string>): Record<string, string> {
  const next = { ...row }
  if (row.property_type) next.property_type = normalizePropertyType(row.property_type)
  if (row.status) next.status = normalizePropertyStatus(row.status)
  if (row.management_fee_value?.trim()) {
    const fee = parseManagementFeeValue(row.management_fee_value)
    if (fee != null && !Number.isNaN(fee)) next.management_fee_value = String(fee)
  }
  return next
}

// ---------- AppSheet / Canary value aliases (leases import) ----------

/** AppSheet / Canary UI lease status labels → leases.status (DB check constraint). */
export const LEASE_STATUS_ALIASES: Record<string, 'active' | 'expired' | 'terminated'> = {
  active: 'active',
  expired: 'expired',
  terminated: 'terminated',
  /** Lease still active, nearing end date. */
  expiring: 'active',
  /** Future start — stored as active until end_date passes. */
  upcoming: 'active',
  /** Marketing / listing state — unit may be vacant but lease row is pre-lease. */
  listed: 'active',
  leased: 'active',
  /** Past lease — same as expired. */
  past: 'expired',
  /** Forced exit — stored as terminated. */
  evicted: 'terminated',
  cancelled: 'terminated',
  canceled: 'terminated',
}

/** Map AppSheet/Canary lease status label to DB leases.status. Empty → ''. */
export function normalizeLeaseStatus(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  for (const key of aliasLookupKeys(raw)) {
    const mapped = LEASE_STATUS_ALIASES[key]
    if (mapped) return mapped
  }
  return trimmed.toLowerCase()
}

/**
 * Parse a CSV property_address field (full AppSheet line or street-only) into street + city.
 * Strips trailing province, postal code, and country segments.
 */
export function parseImportPropertyAddress(raw: string): { street: string; city: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { street: '', city: '' }

  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return { street: '', city: '' }
  if (parts.length === 1) return { street: parts[0], city: '' }

  const street = parts[0]
  const city = parts[1]
  // "12 Duckworth St, NL" — second segment is province only, not a city name.
  if (parts.length === 2 && /^[A-Za-z]{2}$/.test(parts[1])) {
    return { street, city: '' }
  }
  return { street, city }
}

/** Normalize AppSheet-friendly lease row values before validation/insert. */
export function normalizeLeaseImportRow(row: Record<string, string>): Record<string, string> {
  const next = { ...row }
  if (row.status !== undefined) next.status = normalizeLeaseStatus(row.status)
  if (row.lease_term_type !== undefined) next.lease_term_type = normalizeLeaseTermTypeImport(row.lease_term_type)
  return next
}

function normalizeLeaseTermTypeImport(raw: string): string {
  const v = raw.trim().toLowerCase()
  if (!v) return ''
  if (v.includes('month')) return 'month_to_month'
  if (v.includes('fixed')) return 'fixed_term'
  return v.replace(/[\s-]+/g, '_')
}

// ---------- CSV ----------

function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value
}

export function buildTemplateCsv(dataset: ImportDataset): string {
  const spec = IMPORT_SPECS[dataset]
  const lines = [spec.columns.map((c) => c.key).join(',')]
  for (const row of spec.samples) lines.push(row.map(csvEscape).join(','))
  return lines.join('\r\n') + '\r\n'
}

/**
 * Quote-aware CSV parser. Handles quoted fields containing commas, newlines
 * and escaped quotes (""), CRLF/LF line endings, and a leading BOM.
 * Returns rows of raw string cells; blank lines are dropped.
 */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
    } else {
      cell += ch
    }
  }
  row.push(cell)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

export interface ParsedCsv {
  header: string[]
  records: Record<string, string>[]
  /** columns in the spec that were missing from the file and are required */
  missingRequired: string[]
  /** columns in the file that the spec does not know (ignored on import) */
  unknownColumns: string[]
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

/** Parse CSV text and map rows onto a dataset's column keys (header-order independent, alias-aware). */
export function parseCsvForDataset(dataset: ImportDataset, text: string): ParsedCsv {
  const spec = IMPORT_SPECS[dataset]
  const rows = parseCsv(text)
  const rawHeader = (rows[0] ?? []).map(normalizeHeader)
  const aliasMap = new Map<string, string>()
  for (const c of spec.columns) {
    aliasMap.set(c.key, c.key)
    for (const a of c.aliases ?? []) aliasMap.set(a, c.key)
  }
  // Canonical headers win over aliases when both are present in the file.
  const present = new Set(rawHeader.filter((h) => aliasMap.get(h) === h))
  const header = rawHeader.map((h) => {
    const target = aliasMap.get(h)
    if (!target) return h
    if (target !== h && present.has(target)) return h // alias shadowed by canonical column
    return target
  })
  const known = new Set(spec.columns.map((c) => c.key))
  const missingRequired = spec.columns
    .filter((c) => c.required && !header.includes(c.key))
    .map((c) => c.key)
  const unknownColumns = header.filter((h) => h && !known.has(h))
  const records = rows.slice(1).map((cells) => {
    const rec: Record<string, string> = {}
    header.forEach((key, idx) => {
      if (known.has(key)) rec[key] = (cells[idx] ?? '').trim()
    })
    return rec
  })
  return { header, records, missingRequired, unknownColumns }
}
