/**
 * Debug Hospitable reservations for a single linked property.
 * Usage: npx tsx scripts/test-hospitable-property.ts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fetchAllProperties, fetchReservations } from '../src/lib/hospitable/client'
import { mapReservationsToTimeline } from '../src/lib/hospitable/map-reservations'
import type { CanaryProperty } from '../src/lib/canary/types'
import { resolveHospitablePropertyAddresses } from '../src/lib/hospitable/match-property'

const TARGET = 'd26f423d-af7a-43c4-859b-45640c85bed5'
const CANARY_ADDRESS = '21 Front Rd, Dildo'

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq)
      const value = trimmed.slice(eq + 1)
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // optional
  }
}

async function main() {
  loadEnvLocal()
  if (!process.env.HOSPITABLE_API_PAT?.trim()) {
    console.error('HOSPITABLE_API_PAT is not set')
    process.exit(1)
  }

  const properties = await fetchAllProperties()
  const targetProp = properties.find((p) => p.id === TARGET)
  console.log('Target property found:', !!targetProp)
  if (targetProp) {
    console.log('  public_name:', targetProp.public_name)
    console.log('  address.display:', targetProp.address?.display)
    console.log('  listed:', targetProp.listed)
  }

  const start = new Date()
  start.setDate(start.getDate() - 30)
  const end = new Date()
  end.setDate(end.getDate() + 540)
  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)

  const allRes = await fetchReservations({
    propertyIds: properties.map((p) => p.id),
    startDate,
    endDate,
  })
  console.log(`All reservations (${startDate} → ${endDate}):`, allRes.length)

  const targetRes = await fetchReservations({
    propertyIds: [TARGET],
    startDate,
    endDate,
  })
  console.log(`Target property reservations:`, targetRes.length)

  if (targetRes.length > 0) {
    const r = targetRes[0]
    console.log('\nSample reservation shape:')
    console.log('  propertyId:', r.propertyId)
    console.log('  properties[0].id:', r.properties?.[0]?.id)
    console.log('  arrivalDate:', r.arrivalDate, 'departureDate:', r.departureDate)
    console.log('  checkIn:', r.checkIn, 'checkOut:', r.checkOut)
    console.log('  status:', r.status)
    console.log('  reservationStatus:', JSON.stringify(r.reservationStatus?.current))
    console.log('\nFull reservation keys:', Object.keys(r as object))
    console.log('Full reservation JSON:\n', JSON.stringify(r, null, 2))
  }

  const mockCanary = [{ address: CANARY_ADDRESS, hospitablePropertyId: TARGET }] as CanaryProperty[]
  const addrMap = resolveHospitablePropertyAddresses(properties, mockCanary)
  console.log('\nAddress map for target ID:', addrMap.get(TARGET))

  const mapped = mapReservationsToTimeline(targetRes, properties, mockCanary)
  console.log('Mapped bookings for target:', mapped.length)
  for (const b of mapped.slice(0, 5)) {
    console.log(`  - ${b.property} | ${b.start} → ${b.end} | ${b.guestLabel} (${b.platform}) status=${b.status}`)
  }

  const mappedAll = mapReservationsToTimeline(allRes, properties, mockCanary)
  const forFrontRd = mappedAll.filter((b) => b.property === CANARY_ADDRESS)
  console.log(`\nAll mapped bookings for "${CANARY_ADDRESS}":`, forFrontRd.length)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
