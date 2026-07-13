// src/lib/canary/types.ts
// Shapes consumed by the CanaryApp client (ported from the CanaryApp.dc design prototype).
// The server loader (load-db.ts) maps live Supabase rows into these shapes.

import type { LeaseTermType } from './lease-term'

export type CanaryRole = 'Admin' | 'Manager' | 'Owner' | 'Tenant' | 'Vendor'

export interface CanaryProperty {
  id: string
  /** properties.id — used for property-scoped chat threads */
  propertyDbId: string
  /** Full address line, e.g. "12 Duckworth St, St. John's" */
  address: string
  status: string // Vacant | Leased | Maintenance | STR | Office | —
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
  /** Hospitable Public API property UUID for STR calendar matching */
  hospitablePropertyId: string
  mgmtFee: string
  /** raw management fee fields (staff-only edit form) */
  mgmtFeeType: string
  mgmtFeeValue: string
  /** ISO timestamp when archived — hidden from active views when set */
  archivedAt?: string | null
  /** Listing/marketing photo storage paths (inherited by published listings) */
  listingPhotoPaths: string[]
  /** Staff-only photo storage paths (inspections, historical, pre-reno) */
  privatePhotoPaths: string[]
}

export interface CanaryLease {
  id: string
  property: string
  status: string // Active | Expiring | Upcoming | Past | Expired | Terminated
  termType: LeaseTermType
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
  /** Tenant-facing — dollar amount credited against rent */
  rentalCredit: string
  /** Tenant-facing — credit expiry date (YYYY-MM-DD) */
  rentalCreditExpiry: string
  /** Tenant-facing — e.g. Not Included, Internet Included */
  utilitiesIncluded: string
  /** Tenant-facing — pets policy on this lease */
  petsPolicy: string
  /** Tenant-facing — insurance requirement flag */
  insuranceRequired: string
  insuranceConfirmed: string
  policyExpires: string
  insuranceDetails: string
  /** Internal — management window / fees from AppSheet */
  managementStart: string
  managementEnd: string
  managementFeePercent: string
  leasingFeePercent: string
  terminationReason: string
  daysOccupied: string
  /** Internal — AppSheet import metadata */
  appsheetUniqueId: string
  portfolioAppsheetId: string
  folderId: string
  previousLeaseAppsheetId: string
  tenantContactsRaw: string
  appsheetTenantIds: string
  appsheetViewerIds: string
  /** Snapshot at lease time (may differ from current unit) */
  bedrooms: string
  bathrooms: string
  parkingSpots: string
}

/** Timeline/calendar category for ended leases (DB status or date-derived). */
export function isPastLeaseStatus(status: string): boolean {
  return status === 'Past' || status === 'Expired' || status === 'Terminated'
}

/** Map display status back to leases.status enum for editing. */
export function leaseDbStatusFromDisplay(status: string): string {
  if (status === 'Terminated') return 'terminated'
  if (status === 'Expired' || status === 'Past') return 'expired'
  return 'active'
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
  priorityNumber: string
  description: string
  contractors: string
  estimate: string
  startDate: string
  endDate: string
  completedDate: string
  notes: string
  budget: string
  deposit: string
  services: string
  fireRisk: string
  waterDamageRisk: string
  lossOfRentRisk: string
  liabilityRisk: string
}

export interface CanaryPerson {
  id: string
  name: string
  /** Raw DB role array — use for filtering (e.g. includes 'tenant') */
  roles: string[]
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

/** Timeline / composer status for draft listings (maps to listings.status). */
export type DraftListingStatus = 'draft' | 'renewal_sent' | 'published'

export function draftTimelineMeta(d: CanaryDraft) {
  const rent = d.rent ? `$${d.rent}/mo` : ''
  if (d.status === 'published') {
    return { label: 'Listing · public', title: ['Published', rent].filter(Boolean).join(' · '), bg: 'var(--green)', color: 'var(--green-text)', borderStyle: 'none' as const }
  }
  if (d.status === 'renewal_sent') {
    return { label: 'Renewal sent', title: ['Renewal sent', rent].filter(Boolean).join(' · '), bg: 'transparent', color: 'var(--purple)', borderStyle: '2px dashed var(--purple)' as const }
  }
  return { label: 'Draft lease', title: ['Draft', rent].filter(Boolean).join(' · '), bg: 'transparent', color: 'var(--accent)', borderStyle: '2px dashed var(--accent)' as const }
}

export function draftStatusBadge(status: DraftListingStatus): { label: string; color: string } {
  if (status === 'published') return { label: 'PUBLIC', color: 'var(--green)' }
  if (status === 'renewal_sent') return { label: 'RENEWAL SENT', color: 'var(--purple)' }
  return { label: 'DRAFT', color: 'var(--dim)' }
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
  status: DraftListingStatus
  /** When status last changed — used for renewal-sent follow-up dates */
  sentAt: string
}

export type InquiryType = 'inquiry' | 'application'
export type InquiryStatus = 'new' | 'contacted' | 'closed'

export interface CanaryInquiry {
  id: string
  listingId: string
  type: InquiryType
  name: string
  email: string
  phone: string
  status: InquiryStatus
  submittedAt: string
  property: string
  moveIn: string
}

export function inquiryStatusBadge(status: InquiryStatus): { label: string; color: string } {
  if (status === 'new') return { label: 'NEW', color: 'var(--green)' }
  if (status === 'contacted') return { label: 'CONTACTED', color: 'var(--blue)' }
  return { label: 'CLOSED', color: 'var(--dim)' }
}

/** Short-term reservation from Hospitable, mapped for the leases timeline. */
export interface CanaryStrBooking {
  id: string
  /** Timeline row key — matched Canary address or Hospitable label */
  property: string
  hospitablePropertyId: string
  hospitablePropertyName: string
  start: string
  end: string
  /** ISO timestamp for timeline positioning — check-in with time-of-day */
  checkInAt?: string
  /** ISO timestamp for timeline positioning — check-out with time-of-day */
  checkOutAt?: string
  guestLabel: string
  platform: string
  status: string
  nights: number | null
  code: string
}

/** Owner-occupied calendar block — manual stay blocking STR availability. */
export type OwnerOccupiedSource = 'hospitable' | 'local'

export interface CanaryOwnerOccupiedBlock {
  id: string
  /** Timeline row key — matched Canary address or Hospitable label */
  property: string
  propertyId?: string
  hospitablePropertyId?: string
  /** Hospitable reservation id when source is hospitable */
  hospitableReservationId?: string
  start: string
  end: string
  checkInAt?: string
  checkOutAt?: string
  notes: string
  source: OwnerOccupiedSource
  /** Guest / owner label from Hospitable when applicable */
  guestLabel?: string
}

export interface HospitableCalendarData {
  strBookings: CanaryStrBooking[]
  ownerOccupiedBlocks: CanaryOwnerOccupiedBlock[]
  /** True when PAT is set and fetch succeeded */
  connected: boolean
  /** Human-readable status for empty/error states */
  statusMessage: string
  propertyCount: number
}

/** Ops / housekeeping task from Hospitable public API `/v2/tasks`. */
export interface CanaryHospitableTask {
  id: string
  name: string
  /** Matched Canary address or Hospitable property label */
  property: string
  hospitablePropertyId: string
  hospitablePropertyName: string
  guestLabel: string
  /** YYYY-MM-DD due / start date */
  dueDate: string
  startAt: string
  endAt: string
  /** Display status (progress or assignment) */
  status: string
  progressStatus: string
  assignmentStatus: string
  type: string
  typeId: number | null
  teammate: string
  reservationCode: string
  reservationId: string
  note: string
  /** IANA timezone from Hospitable when provided */
  timezone: string
  /** Scheduled duration in hours */
  durationHours: number | null
  /** Hospitable service id when provided */
  serviceId: number | null
  /** ISO timestamp of last assignment status change */
  assignmentUpdatedAt: string
}

export interface HospitableTasksData {
  tasks: CanaryHospitableTask[]
  connected: boolean
  statusMessage: string
  /** Count of open/active tasks (not completed/cancelled) */
  openCount: number
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
  orgId: string
  properties: CanaryProperty[]
  leases: CanaryLease[]
  portfolios: CanaryPortfolio[]
  projects: CanaryProject[]
  people: CanaryPerson[]
  drafts: CanaryDraft[]
  payments: CanaryPayment[]
  inquiries: CanaryInquiry[]
}
