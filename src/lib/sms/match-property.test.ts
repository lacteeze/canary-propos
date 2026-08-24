import { describe, it, expect } from 'vitest'
import { matchProperties } from './match-property'

const caseyA = { id: 'a', street_address: "73 Casey Street, St. John's" }
const duckworth = { id: 'b', street_address: '10 Duckworth St' }
const caseyB = { id: 'c', street_address: '12 Casey Avenue, St. John\'s' }

describe('matchProperties', () => {
  it('matches a unique number + street token', () => {
    const hits = matchProperties('73 Casey', [caseyA, duckworth])
    expect(hits.map((h) => h.id)).toEqual(['a'])
  })

  it('returns both Casey streets when the hint is ambiguous', () => {
    const hits = matchProperties('Casey', [caseyA, caseyB])
    expect(hits.map((h) => h.id).sort()).toEqual(['a', 'c'])
  })

  it('returns empty when nothing matches', () => {
    expect(matchProperties('99 Nowhere', [caseyA, duckworth])).toEqual([])
  })
})
