/**
 * Seeds published rental listings for the Canary org from the imported AppSheet data.
 * Idempotent: matches on org + street_address, re-runs safely.
 *
 * Usage:
 *   npm run seed:listings
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { leaseHighlightForTermType } from '../src/lib/landing/listing-term'

interface SeedListing {
  sourceId: string
  address: string
  beds: number | null
  baths: number | null
  rate: number | null
  pets: string
  availableDate: string
  propertyType?: 'house' | 'duplex' | 'apartment_building' | 'condo' | 'townhouse' | 'other'
  termType?: 'long' | 'mid'
  description: string
}

function numOrNull(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null
  return value
}

function resolveBeds(item: SeedListing): number {
  const beds = numOrNull(item.beds)
  if (beds != null) return beds
  return item.propertyType === 'other' ? 0 : 1
}

function resolveBaths(item: SeedListing): number {
  const baths = numOrNull(item.baths)
  if (baths != null) return baths
  return item.propertyType === 'other' ? 0 : 1
}

function loadEnvFile() {
  try {
    const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx <= 0) continue
      const key = trimmed.slice(0, idx)
      const value = trimmed.slice(idx + 1)
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // .env.local optional when vars are already exported
  }
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.'
    )
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function parseAddress(full: string) {
  const parts = full.split(',').map((s) => s.trim())
  const street_address = parts[0] ?? full
  const city = parts[1] ?? "St. John's"
  const provPostal = parts[2] ?? 'NL'
  const match = provPostal.match(/^([A-Z]{2})\s+([A-Z0-9]{3}\s?[A-Z0-9]{3})?/i)
  return {
    street_address,
    city,
    province: (match?.[1] ?? 'NL').toUpperCase(),
    postal_code: match?.[2]?.replace(/\s+/g, ' ') ?? null,
  }
}

function shortTitle(address: string) {
  return address.split(',')[0]?.trim() ?? address
}

function petAmenities(pets: string): string[] {
  return /approval|friendly|yes|dog|cat/i.test(pets) ? ['pet friendly'] : []
}

async function ensureOrg(
  service: ReturnType<typeof getServiceClient>,
  slug: string
) {
  const { data: existing } = await service
    .from('organizations')
    .select('id, name, slug, plan_unit_limit')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) return existing

  const { data: canaryOrg } = await service
    .from('organizations')
    .select('id, name, slug, plan_unit_limit')
    .ilike('name', 'Canary%')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (canaryOrg) {
    const { data: updated, error } = await service
      .from('organizations')
      .update({ slug, plan_unit_limit: Math.max(canaryOrg.plan_unit_limit, 30) })
      .eq('id', canaryOrg.id)
      .select('id, name, slug, plan_unit_limit')
      .single()

    if (error || !updated) {
      throw new Error(`Failed to update org slug: ${error?.message}`)
    }
    return updated
  }

  const { data: created, error } = await service
    .from('organizations')
    .insert({
      name: 'Canary Property Management',
      slug,
      province: 'NL',
      plan_type: 'starter',
      plan_unit_limit: 10,
    })
    .select('id, name, slug, plan_unit_limit')
    .single()

  if (error || !created) {
    throw new Error(`Failed to create org: ${error?.message}`)
  }
  return created
}

async function upsertListing(
  service: ReturnType<typeof getServiceClient>,
  orgId: string,
  item: SeedListing
) {
  const parsed = parseAddress(item.address)
  const beds = resolveBeds(item)
  const baths = resolveBaths(item)
  const rate = numOrNull(item.rate)
  const propertyType = item.propertyType ?? 'house'
  const unitNumber = parsed.street_address.includes('Unit')
    ? parsed.street_address.split('Unit')[1]?.trim().replace(/^[-,\s]+/, '') ?? null
    : null

  const { data: existingProperty } = await service
    .from('properties')
    .select('id')
    .eq('org_id', orgId)
    .eq('street_address', parsed.street_address)
    .maybeSingle()

  let propertyId = existingProperty?.id

  if (!propertyId) {
    const { data: property, error } = await service
      .from('properties')
      .insert({
        org_id: orgId,
        street_address: parsed.street_address,
        city: parsed.city,
        province: parsed.province,
        postal_code: parsed.postal_code,
        property_type: propertyType,
      })
      .select('id')
      .single()

    if (error || !property) {
      throw new Error(`Property insert failed (${item.address}): ${error?.message}`)
    }
    propertyId = property.id
  }

  let unitQuery = service
    .from('units')
    .select('id')
    .eq('org_id', orgId)
    .eq('property_id', propertyId)

  if (unitNumber) {
    unitQuery = unitQuery.eq('unit_number', unitNumber)
  }

  const { data: existingUnits } = await unitQuery
  let unitId = existingUnits?.[0]?.id

  if (!unitId) {
    const { data: unit, error } = await service
      .from('units')
      .insert({
        org_id: orgId,
        property_id: propertyId,
        unit_number: unitNumber,
        bedrooms: beds,
        bathrooms: baths,
        status: 'vacant',
        asking_rent: rate,
        amenities: petAmenities(item.pets),
      })
      .select('id')
      .single()

    if (error || !unit) {
      throw new Error(`Unit insert failed (${item.address}): ${error?.message}`)
    }
    unitId = unit.id
  } else {
    await service
      .from('units')
      .update({
        unit_number: unitNumber,
        bedrooms: beds,
        bathrooms: baths,
        status: 'vacant',
        asking_rent: rate,
        amenities: petAmenities(item.pets),
      })
      .eq('id', unitId)
  }

  const title = shortTitle(item.address)
  const termType = item.termType ?? 'long'
  const highlights = [
    beds > 0 ? `${beds} bedroom${beds === 1 ? '' : 's'}` : 'Commercial space',
    baths > 0 ? `${baths} bath${baths === 1 ? '' : 's'}` : null,
    leaseHighlightForTermType(termType),
  ].filter((h): h is string => Boolean(h))

  const { data: existingListing } = await service
    .from('listings')
    .select('id')
    .eq('unit_id', unitId)
    .maybeSingle()

  if (existingListing) {
    const { error } = await service
      .from('listings')
      .update({
        listing_title: title,
        listing_description: item.description,
        highlights,
        display_rent: rate,
        status: 'published',
        available_from: item.availableDate || null,
      })
      .eq('id', existingListing.id)

    if (error) {
      throw new Error(`Listing update failed (${item.address}): ${error.message}`)
    }
    return existingListing.id
  }

  const { data: listing, error } = await service
    .from('listings')
    .insert({
      org_id: orgId,
      unit_id: unitId,
      listing_title: title,
      listing_description: item.description,
      highlights,
      display_rent: rate,
      status: 'published',
      available_from: item.availableDate || null,
    })
    .select('id')
    .single()

  if (error || !listing) {
    throw new Error(`Listing insert failed (${item.address}): ${error?.message}`)
  }
  return listing.id
}

async function main() {
  loadEnvFile()

  const orgSlug = process.env.SEED_ORG_SLUG ?? 'canary'
  const service = getServiceClient()
  const dataPath = join(process.cwd(), 'scripts/data/canary-vacant-listings.json')
  const items = JSON.parse(readFileSync(dataPath, 'utf8')) as SeedListing[]

  const org = await ensureOrg(service, orgSlug)
  console.log(`Using org: ${org.name} (${org.slug})`)

  await service
    .from('organizations')
    .update({ plan_unit_limit: Math.max(org.plan_unit_limit, items.length + 5) })
    .eq('id', org.id)

  const listingIds: string[] = []
  for (const item of items) {
    const id = await upsertListing(service, org.id, item)
    listingIds.push(id)
    const rentLabel = item.rate ? `$${item.rate}/mo` : 'rate TBD'
    console.log(`✓ ${shortTitle(item.address)} — ${rentLabel}`)
  }

  console.log(`\nSeeded ${listingIds.length} published listing(s).`)
  console.log(`Set NEXT_PUBLIC_DEFAULT_ORG_SLUG=${org.slug} on Vercel.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
