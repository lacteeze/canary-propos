/**
 * B3: anon cannot read owner_id or management_fee_value on properties.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { seedTwoOrgs, type SeedFixture } from '../helpers/seed'
import type { Database } from '@/types/supabase'

function getAnonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

describe('B3 public property column exposure', () => {
  let fixture: SeedFixture
  let propertyId: string

  beforeAll(async () => {
    fixture = await seedTwoOrgs()
    const service = getServiceClient()
    const { data, error } = await service
      .from('properties')
      .insert({
        org_id: fixture.orgA.orgId,
        street_address: '1 Test Street',
        city: "St. John's",
        province: 'NL',
        property_type: 'house',
        slug: `test-property-${Date.now()}`,
        owner_id: fixture.orgA.owner1.personId,
        management_fee_value: 99.5,
      })
      .select('id')
      .single()
    if (error || !data) {
      throw new Error(`Failed to seed property: ${error?.message}`)
    }
    propertyId = data.id
  }, 60_000)

  afterAll(async () => {
    const service = getServiceClient()
    if (propertyId) {
      await service.from('properties').delete().eq('id', propertyId)
    }
    await fixture.cleanup()
  }, 30_000)

  it('anon cannot select owner_id or management_fee_value', async () => {
    const anon = getAnonClient()
    const { data, error } = await anon
      .from('properties')
      .select('owner_id, management_fee_value')
      .eq('id', propertyId)

    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('anon can read public_properties without fee or owner columns', async () => {
    const anon = getAnonClient()
    const { data, error } = await anon
      .from('public_properties')
      .select('id, street_address')
      .eq('id', propertyId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data?.id).toBe(propertyId)
    expect(data).not.toHaveProperty('owner_id')
    expect(data).not.toHaveProperty('management_fee_value')
  })
})
