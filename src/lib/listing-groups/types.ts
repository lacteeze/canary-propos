import type { BrowseListing } from '@/lib/listings/browse-types'

export type ListingGroupKind =
  | 'index'
  | 'city'
  | 'neighborhood'
  | 'beds'
  | 'type'
  | 'amenity'
  | 'city-beds'

export type NeighborhoodSlug = 'downtown' | 'east-end' | 'west-end'

export type ListingGroupMatch =
  | { kind: 'all' }
  | { kind: 'city'; citySlug: string }
  | { kind: 'neighborhood'; citySlug: string; neighborhood: NeighborhoodSlug }
  | { kind: 'beds'; min: number; max?: number }
  | { kind: 'type'; types: readonly string[] }
  | { kind: 'amenity'; amenity: 'pets' }
  | { kind: 'city-beds'; citySlug: string; min: number; max?: number }

export type ListingGroupFaq = {
  q: string
  a: string
}

export type ListingGroupDef = {
  path: string
  kind: ListingGroupKind
  h1: string
  title: string
  description: string
  /** Place phrase used in the live answer lead, e.g. "St. John's". */
  place: string
  /** Noun phrase for inventory, e.g. "two-bedroom homes". */
  noun: string
  answerLead: string
  emptyLead: string
  body: string[]
  faqs: ListingGroupFaq[]
  related: string[]
  match: ListingGroupMatch
  crumbs: { label: string; path: string }[]
}

export type ListingGroupInventory = {
  listings: BrowseListing[]
  count: number
  minRent: number | null
  asOf: string
}

export function rentalsHref(path: string, orgSlug?: string | null): string {
  const base = path ? `/rentals/${path}` : '/rentals'
  if (orgSlug && orgSlug !== 'canary') return `${base}?org=${orgSlug}`
  return base
}

export function formatGroupAsOf(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/St_Johns',
  }).format(date)
}

export function formatCad(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(amount)
}
