/**
 * Quick local smoke test for Hospitable PAT + property mapping.
 * Usage: npx tsx scripts/test-hospitable.ts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fetchListedProperties } from '../src/lib/hospitable/client'
import { mapPropertiesToStays } from '../src/lib/hospitable/map-property-to-stay'

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
    // .env.local optional for CI
  }
}

async function main() {
  loadEnvLocal()
  if (!process.env.HOSPITABLE_API_PAT?.trim()) {
    console.error('HOSPITABLE_API_PAT is not set')
    process.exit(1)
  }

  const properties = await fetchListedProperties()
  const stays = mapPropertiesToStays(properties)
  console.log(`Listed properties: ${properties.length}`)
  console.log(`Mapped stays: ${stays.length}`)
  for (const stay of stays.slice(0, 5)) {
    console.log(`- ${stay.short} (${stay.town}) | ${stay.beds} bed / ${stay.baths} bath | ${stay.extra}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
