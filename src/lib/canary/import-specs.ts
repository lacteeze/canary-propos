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
      'One row per unit. Rows sharing the same street address + city are grouped into a single property with multiple units. Duplicate units are skipped.',
    columns: [
      { key: 'street_address', required: true, note: '', example: '12 Duckworth St' },
      { key: 'city', required: true, note: '', example: "St. John's" },
      { key: 'province', required: true, note: '', example: 'NL' },
      { key: 'postal_code', note: '', example: 'A1C 1G4' },
      { key: 'property_type', note: 'house, duplex, apartment_building, condo, townhouse or other', example: 'house' },
      { key: 'portfolio_name', note: 'Must match an existing portfolio name', example: 'Harbourview Holdings' },
      { key: 'owner_email', note: 'Must match an existing person with the owner role', example: 'owner@example.com' },
      { key: 'unit_number', note: 'Leave blank for single-unit properties', example: '2B' },
      { key: 'bedrooms', note: 'Whole number, defaults to 1', example: '2' },
      { key: 'bathrooms', note: 'Number, defaults to 1 (1.5 allowed)', example: '1.5' },
      { key: 'sq_footage', note: 'Whole number', example: '850' },
      { key: 'status', note: 'vacant, occupied or maintenance — defaults to vacant', example: 'vacant' },
      { key: 'asking_rent', note: 'Monthly asking rent (numbers only)', example: '1600' },
      { key: 'management_fee_type', note: 'percent or flat', example: 'percent' },
      { key: 'management_fee_value', note: 'e.g. 10 for 10% or 150 for $150 flat', example: '10' },
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
      'One row per lease. The property and tenant must already exist (import Properties and People first). Duplicate leases (same unit, tenant and start date) are skipped.',
    columns: [
      { key: 'property_address', required: true, note: 'Street address of an imported property', example: '12 Duckworth St' },
      { key: 'unit_number', note: 'Required when the property has multiple units', example: '2B' },
      { key: 'tenant_email', required: true, note: 'Must match an imported person', example: 'jane@example.com' },
      { key: 'start_date', required: true, note: 'YYYY-MM-DD', example: '2026-07-01' },
      { key: 'end_date', required: true, note: 'YYYY-MM-DD', example: '2027-06-30' },
      { key: 'monthly_rent', required: true, note: 'Numbers only', example: '1600' },
      { key: 'deposit_amount', note: 'Defaults to 0', example: '800' },
      { key: 'rent_due_day', note: '1–28, defaults to 1', example: '1' },
      { key: 'status', note: 'active, expired or terminated — defaults to active', example: 'active' },
    ],
    samples: [
      ['12 Duckworth St', '1', 'jane@example.com', '2026-07-01', '2027-06-30', '1600', '800', '1', 'active'],
      ['45 Gower St', '', 'mark@example.com', '2025-09-01', '2026-08-31', '1450', '725', '1', 'active'],
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
      'Maintenance projects / work orders. The property must already exist. Vendors are matched by email or name. AppSheet export headers (Project, Property, Estimate, Completed, Project ID, …) are recognized automatically; rows with a Project ID already imported are skipped.',
    columns: [
      { key: 'property_address', required: true, note: 'Street address of an imported property — full AppSheet addresses ("…, St. John\u2019s, NL …, Canada") are matched on the street portion', example: '12 Duckworth St', aliases: ['property'] },
      { key: 'unit_number', note: 'Optional unit on the property', example: '2B' },
      { key: 'title', required: true, note: 'Project name', example: 'Replace bathroom fan', aliases: ['project'] },
      { key: 'description', note: 'Defaults to the title when blank', example: 'Fan is noisy and no longer venting.' },
      { key: 'priority', note: 'low, medium, high or urgent — AppSheet labels (1 - Urgent … 5 - Complete) map automatically; defaults to medium', example: 'medium' },
      { key: 'status', note: 'draft, submitted, assigned, in_progress, pending_approval, approved, completed, closed, postponed or cancelled — AppSheet labels (Requires Estimate, Approved to Schedule, …) map automatically; defaults to submitted', example: 'submitted' },
      { key: 'vendor_email', note: 'Must match an imported person with the vendor role', example: 'bob@buildco.ca' },
      { key: 'contractor', note: 'Vendor by "Name: phone: email" or plain name — matched leniently, unmatched values are kept in notes', example: 'Bob Smith: 709-555-0987: bob@buildco.ca', aliases: ['contractors'] },
      { key: 'category', note: 'Type of work, e.g. Roofing, Plumbing', example: 'Plumbing', aliases: ['services'] },
      { key: 'estimated_cost', note: 'Numbers only', example: '350', aliases: ['estimate'] },
      { key: 'budget', note: 'Approved project budget — numbers only', example: '5000' },
      { key: 'deposit', note: 'Deposit amount — numbers only', example: '500' },
      { key: 'start_date', note: 'YYYY-MM-DD (AppSheet timestamps accepted)', example: '2026-07-01' },
      { key: 'end_date', note: 'YYYY-MM-DD', example: '2026-07-15' },
      { key: 'completed_date', note: 'YYYY-MM-DD — when the work finished', example: '2026-07-14', aliases: ['completed'] },
      { key: 'notes', note: 'Internal notes', example: '24 hours notice required' },
      { key: 'external_ref', note: 'AppSheet Project ID — re-imports of the same id are skipped', example: '961de1ed', aliases: ['project_id'] },
    ],
    samples: [
      ['12 Duckworth St', '1', 'Replace bathroom fan', 'Fan is noisy and no longer venting.', 'medium', 'submitted', 'bob@buildco.ca', '', 'Electrical', '350', '', '', '2026-07-01', '', '', '24 hours notice required', ''],
      ['45 Gower St', '', 'Paint front door', 'Peeling paint, needs scrape + 2 coats.', 'low', 'draft', '', 'Bob Smith: 709-555-0987: bob@buildco.ca', 'Painting', '150', '', '', '', '', '', '', ''],
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
