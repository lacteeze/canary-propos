/**
 * Probe Hospitable reservations + property list for calendar overlay debugging.
 * Usage: npx tsx scripts/test-hospitable-calendar.ts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fetchAllProperties, fetchReservations } from '../src/lib/hospitable/client'
import { mapReservationsToTimeline } from '../src/lib/hospitable/map-reservations'

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
  console.log(`Properties: ${properties.length}`)

  const start = new Date()
  start.setDate(start.getDate() - 30)
  const end = new Date()
  end.setDate(end.getDate() + 180)

  const reservations = await fetchReservations({
    propertyIds: properties.map((p) => p.id),
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  })
  console.log(`Reservations: ${reservations.length}`)

  const mapped = mapReservationsToTimeline(reservations, properties, [])
  for (const b of mapped.slice(0, 8)) {
    console.log(`- ${b.property} | ${b.start} → ${b.end} | ${b.guestLabel} (${b.platform})`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
