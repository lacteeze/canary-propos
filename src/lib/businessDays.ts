/**
 * businessDays.ts — Canadian business day utilities
 *
 * Excludes weekends and Canadian federal holidays from business day counts.
 */

/**
 * Calculate Good Friday for a given year using the Anonymous Gregorian algorithm.
 * Returns a Date object for Good Friday.
 */
function getGoodFriday(year: number): Date {
  // Anonymous Gregorian algorithm for Easter Sunday
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 1-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1

  // Easter Sunday
  const easter = new Date(year, month - 1, day)
  // Good Friday is 2 days before Easter Sunday
  const goodFriday = new Date(easter)
  goodFriday.setDate(easter.getDate() - 2)
  return goodFriday
}

/**
 * Returns the first Monday on or after the given date.
 */
function firstMondayOnOrAfter(year: number, month: number, day: number): Date {
  const d = new Date(year, month - 1, day)
  const dow = d.getDay() // 0=Sun, 1=Mon, ...
  const diff = dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow
  d.setDate(d.getDate() + diff)
  return d
}

/**
 * Returns the Nth Monday of a given month/year.
 * n=1 → first Monday, n=2 → second Monday, etc.
 */
function nthMonday(year: number, month: number, n: number): Date {
  // Find first Monday of the month
  const first = firstMondayOnOrAfter(year, month, 1)
  const result = new Date(first)
  result.setDate(first.getDate() + (n - 1) * 7)
  return result
}

/**
 * Returns a Set of 'YYYY-MM-DD' strings for Canadian federal holidays in the given year.
 *
 * Federal holidays included:
 * - New Year's Day (Jan 1)
 * - Good Friday (calculated)
 * - Canada Day (Jul 1, observed Mon if Sun)
 * - Labour Day (first Monday of September)
 * - Thanksgiving (second Monday of October)
 * - Remembrance Day (Nov 11)
 * - Christmas Day (Dec 25)
 * - Boxing Day (Dec 26)
 *
 * Note: Victoria Day (third Monday before May 25) is a federal holiday but
 * commonly observed — included for completeness.
 */
function getCanadianFederalHolidays(year: number): Set<string> {
  const fmt = (d: Date): string => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const holidays: Date[] = []

  // New Year's Day — Jan 1
  holidays.push(new Date(year, 0, 1))

  // Good Friday
  holidays.push(getGoodFriday(year))

  // Victoria Day — Monday before May 25
  const may25 = new Date(year, 4, 25)
  const may25dow = may25.getDay() // 0=Sun
  // Subtract days to reach the Monday before (or on) May 25
  const victoriaDay = new Date(may25)
  victoriaDay.setDate(may25.getDate() - (may25dow === 1 ? 7 : may25dow === 0 ? 6 : may25dow - 1))
  holidays.push(victoriaDay)

  // Canada Day — Jul 1 (if Sunday, observed Monday)
  const canadaDay = new Date(year, 6, 1)
  if (canadaDay.getDay() === 0) {
    holidays.push(new Date(year, 6, 2))
  } else {
    holidays.push(canadaDay)
  }

  // Labour Day — first Monday of September
  holidays.push(nthMonday(year, 9, 1))

  // Thanksgiving — second Monday of October
  holidays.push(nthMonday(year, 10, 2))

  // Remembrance Day — Nov 11
  holidays.push(new Date(year, 10, 11))

  // Christmas Day — Dec 25
  holidays.push(new Date(year, 11, 25))

  // Boxing Day — Dec 26
  holidays.push(new Date(year, 11, 26))

  return new Set(holidays.map(fmt))
}

/**
 * Adds `days` business days to `startDate`, skipping weekends and
 * Canadian federal holidays.
 *
 * The start date itself is NOT counted — counting begins the next day.
 * Returns a new Date; does not mutate the input.
 */
export function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate)
  // Cache holiday sets by year to avoid recalculation
  const holidayCache = new Map<number, Set<string>>()

  const getHolidays = (year: number): Set<string> => {
    if (!holidayCache.has(year)) {
      holidayCache.set(year, getCanadianFederalHolidays(year))
    }
    return holidayCache.get(year)!
  }

  const fmt = (d: Date): string => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  let remaining = days
  while (remaining > 0) {
    result.setDate(result.getDate() + 1)
    const dow = result.getDay()
    if (dow === 0 || dow === 6) continue // Skip weekend
    if (getHolidays(result.getFullYear()).has(fmt(result))) continue // Skip holiday
    remaining--
  }

  return result
}
