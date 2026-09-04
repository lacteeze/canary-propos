export const CITY_DISPLAY: Record<string, string> = {
  'st-johns': "St. John's",
  'mount-pearl': 'Mount Pearl',
  paradise: 'Paradise',
  'conception-bay-south': 'Conception Bay South',
  torbay: 'Torbay',
  'portugal-cove': "Portugal Cove–St. Philip's",
  'clarkes-beach': "Clarke's Beach",
  dildo: 'Dildo',
}

const CITY_ALIASES: Record<string, string> = {
  "st. john's": 'st-johns',
  'st. johns': 'st-johns',
  "st john's": 'st-johns',
  'st johns': 'st-johns',
  "saint john's": 'st-johns',
  'saint johns': 'st-johns',
  'st-johns': 'st-johns',
  'mount pearl': 'mount-pearl',
  'mount-pearl': 'mount-pearl',
  paradise: 'paradise',
  'conception bay south': 'conception-bay-south',
  cbs: 'conception-bay-south',
  'c.b.s.': 'conception-bay-south',
  'c.b.s': 'conception-bay-south',
  'conception-bay-south': 'conception-bay-south',
  torbay: 'torbay',
  "portugal cove-st. philip's": 'portugal-cove',
  'portugal cove-st. philips': 'portugal-cove',
  "portugal cove-st philip's": 'portugal-cove',
  'portugal cove-st philips': 'portugal-cove',
  'portugal cove': 'portugal-cove',
  "st. philip's": 'portugal-cove',
  'st. philips': 'portugal-cove',
  "st philip's": 'portugal-cove',
  'st philips': 'portugal-cove',
  'portugal-cove': 'portugal-cove',
  "clarke's beach": 'clarkes-beach',
  'clarkes beach': 'clarkes-beach',
  'clarkes-beach': 'clarkes-beach',
  dildo: 'dildo',
}

export function normalizeCityKey(city: string | null | undefined): string {
  return (city ?? '')
    .normalize('NFKD')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function citySlugFromName(city: string | null | undefined): string | null {
  const key = normalizeCityKey(city)
  if (!key) return null
  return CITY_ALIASES[key] ?? null
}

export function listingMatchesCitySlug(
  city: string | null | undefined,
  citySlug: string,
): boolean {
  return citySlugFromName(city) === citySlug
}

export function bedsGroupPath(beds: number): string {
  if (beds <= 1) return '1-bedroom'
  if (beds === 2) return '2-bedroom'
  return '3-bedroom'
}
