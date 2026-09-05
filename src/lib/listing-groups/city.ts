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
  "st.john's": 'st-johns',
  'st.johns': 'st-johns',
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
  if (CITY_ALIASES[key]) return CITY_ALIASES[key]
  const slugified = key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (CITY_DISPLAY[slugified]) return slugified
  for (const [alias, slug] of Object.entries(CITY_ALIASES)) {
    if (key === alias || key.startsWith(`${alias},`) || key.startsWith(`${alias} `)) {
      return slug
    }
  }
  return null
}

/** Pull a city from "12 Water St, St. John's, NL A1C 1A1, Canada". */
export function cityFromStreetAddress(address: string | null | undefined): string | null {
  if (!address) return null
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean)
  for (const part of parts.slice(1)) {
    if (/^(NL|NS|NB|PE|QC|ON|MB|SK|AB|BC|YT|NT|NU)\b/i.test(part)) continue
    if (/^canada$/i.test(part)) continue
    if (/^[A-Z]\d[A-Z]/i.test(part)) continue
    if (citySlugFromName(part)) return part
  }
  return null
}

export function listingMatchesCitySlug(
  city: string | null | undefined,
  citySlug: string,
  streetAddress?: string | null,
): boolean {
  if (citySlugFromName(city) === citySlug) return true
  const fromStreet = cityFromStreetAddress(streetAddress)
  if (fromStreet && citySlugFromName(fromStreet) === citySlug) return true
  const display = normalizeCityKey(CITY_DISPLAY[citySlug] ?? '')
  if (display && normalizeCityKey(streetAddress).includes(display)) return true
  return false
}

export function bedsGroupPath(beds: number): string {
  if (beds <= 1) return '1-bedroom'
  if (beds === 2) return '2-bedroom'
  return '3-bedroom'
}
