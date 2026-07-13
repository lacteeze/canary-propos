import { describe, expect, it } from 'vitest'
import { leaseBarRange, leaseBarRangeForLease, tlRangesOverlap } from '@/lib/canary/timeline-times'

describe('leaseBarRange', () => {
  it('parses plain YYYY-MM-DD dates', () => {
    const range = leaseBarRange('2025-07-26', '2026-07-31')
    expect(range).not.toBeNull()
    expect(range!.endMs).toBeGreaterThan(range!.startMs)
  })

  it('parses ISO datetime prefixes (RSC / driver quirks)', () => {
    const range = leaseBarRange('2025-07-26T00:00:00.000Z', '2026-07-31T00:00:00.000Z')
    expect(range).not.toBeNull()
    const plain = leaseBarRange('2025-07-26', '2026-07-31')
    expect(range!.startMs).toBe(plain!.startMs)
    expect(range!.endMs).toBe(plain!.endMs)
  })

  it('open-ended leases extend through the visible window', () => {
    const through = new Date(2026, 6, 31, 23, 59, 59, 999).getTime()
    const range = leaseBarRangeForLease('2025-01-01', '', 'month_to_month', through)
    expect(range).not.toBeNull()
    expect(range!.endMs).toBe(through)
    const winStart = new Date(2026, 6, 1).getTime()
    const winEnd = new Date(2026, 6, 31).getTime()
    expect(tlRangesOverlap(range!.startMs, range!.endMs, winStart, winEnd)).toBe(true)
  })
})
