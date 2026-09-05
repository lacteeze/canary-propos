import { describe, expect, it } from 'vitest'
import { LISTING_GROUPS } from './registry'

describe('LISTING_GROUPS', () => {
  it('keeps unique titles, H1s, and explainers', () => {
    const titles = LISTING_GROUPS.map((g) => g.title)
    const h1s = LISTING_GROUPS.map((g) => g.h1)
    const bodies = LISTING_GROUPS.map((g) => g.body.join('\n'))
    expect(new Set(titles).size).toBe(titles.length)
    expect(new Set(h1s).size).toBe(h1s.length)
    expect(new Set(bodies).size).toBe(bodies.length)
  })

  it('includes the planned metro, facet, and neighbourhood paths', () => {
    const paths = new Set(LISTING_GROUPS.map((g) => g.path))
    for (const path of [
      '',
      'st-johns',
      'mount-pearl',
      'paradise',
      'conception-bay-south',
      'torbay',
      'portugal-cove',
      'clarkes-beach',
      'dildo',
      'st-johns/downtown',
      'st-johns/east-end',
      'st-johns/west-end',
      '1-bedroom',
      '2-bedroom',
      '3-bedroom',
      'apartments',
      'houses',
      'pet-friendly',
      'st-johns/1-bedroom',
      'st-johns/2-bedroom',
      'st-johns/3-bedroom',
    ]) {
      expect(paths.has(path)).toBe(true)
    }
  })
})
