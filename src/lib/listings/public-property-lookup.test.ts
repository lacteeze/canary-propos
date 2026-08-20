import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leased public URL lookup', () => {
  it('does not call optional RPCs that 404 when the migration is not applied', () => {
    const page = readFileSync('src/lib/listings/public-slug-page.tsx', 'utf8')
    const lookup = readFileSync('src/lib/listings/public-property-lookup.ts', 'utf8')
    const forbidden = [
      'public_property_is_leased',
      'public_property_id_for_slug',
      'public_property_id_for_listing',
    ]
    for (const name of forbidden) {
      expect(page).not.toContain(name)
      expect(lookup).not.toContain(name)
    }
    expect(lookup).not.toMatch(/\.rpc\(/)
    expect(page).not.toMatch(/\.rpc\(/)
  })
})
