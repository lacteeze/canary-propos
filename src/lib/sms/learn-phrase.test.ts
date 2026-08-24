import { describe, it, expect } from 'vitest'
import { normalizeJobPhrase } from './learn-phrase'

describe('normalizeJobPhrase', () => {
  it('keeps the job name and strips address, money, and hours', () => {
    expect(normalizeJobPhrase('Airbnb Restock 73 Casey Street plus 2 hours')).toBe('airbnb restock')
  })

  it('returns null for generic charge shorthand', () => {
    expect(normalizeJobPhrase('Charge 73 Casey $100')).toBeNull()
  })
})
