// src/lib/canary/types.ts
// Shapes consumed by the CanaryApp client (ported from the CanaryApp.dc design prototype).
// The server loader (load-db.ts) maps live Supabase rows into these shapes.

export type CanaryRole = 'Admin' | 'Manager' | 'Owner' | 'Tenant' | 'Vendor'

export interface CanaryProperty {
  id: string
  /** properties.id — used for property-scoped chat threads */
  propertyDbId: string
  /** Full address line, e.g. "12 Duckworth St, St. John's" */
  address: string
  status: string // Vacant | Leased | Maintenance | —
  beds: string
  baths: string
  parking: string
  rate: number | null
  city: string
  area: string
  type: string
  availableDate: string
  petFriendly: string
  utilitiesIncluded: string
  description: string
  portfolioId: string
  ownerId: string
  /** underlying unit id — used when creating listings */
  unitId: string
  mgmtFee: string
}

export interface CanaryLease {
  id: string
  property: string
  status: string // Active | Expiring | Upcoming | Past
  start: string
  end: string
  rent: string
  tenantInfo: string
  tenantIds: string
  months: string
  deposit: string
  renewal: string
  utilities: string
  notes: string
}

export interface CanaryPortfolio {
  id: string
  name: string
  ownerIds: string
  status: string
  leasingFee: string
  longFee: string
  shortFee: string
  startDate: string
  notes: string
}

export interface CanaryProject {
  id: string
  /** properties.id for the linked property */
  propertyDbId: string
  name: string
  property: string
  status: string
  priority: string
  description: string
  contractors: string
  estimate: string
}

export interface CanaryPerson {
  id: string
  name: string
  role: string // Client | Tenant | Vendor | Admin | Realtor | Accountant | Contact
  email: string
  phone: string
  company: string
  status: string
  address: string // mailing address (billing / legal)
  website: string
  services: string
  rating: string
  notes: string
  // Tenant inquiry preferences — only shown in the UI for tenants
  minBeds: string
  minBaths: string
  minParking: string
  pets: string
  moveIn: string
  leaseType: string
  maxPrice: string
}

export interface CanaryDraft {
  id: string
  propId: string
  unitId: string
  address: string
  rent: string
  start: string
  end: string
  beds: string
  baths: string
  parking: string
  pets: string
  utilities: string
  description: string
  published: boolean
}

export interface CanaryPayment {
  id: string
  date: string
  property: string
  category: string
  description: string
  amount: string
  type: 'Credit' | 'Debit'
  /** true when the row came from the database (read-only in the UI) */
  persisted?: boolean
}

export interface CanaryDb {
  properties: CanaryProperty[]
  leases: CanaryLease[]
  portfolios: CanaryPortfolio[]
  projects: CanaryProject[]
  people: CanaryPerson[]
  drafts: CanaryDraft[]
  payments: CanaryPayment[]
}
