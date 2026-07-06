const HOSPITABLE_API_BASE = 'https://public.api.hospitable.com'

export interface HospitablePropertyAddress {
  city?: string | null
  display?: string | null
}

export interface HospitablePropertyCapacity {
  max?: number | null
  bedrooms?: number | null
  beds?: number | null
  bathrooms?: number | null
}

export interface HospitablePropertyBookings {
  site_urls?: string[] | null
}

export interface HospitableProperty {
  id: string
  name?: string | null
  public_name?: string | null
  picture?: string | null
  listed?: boolean | null
  address?: HospitablePropertyAddress | null
  capacity?: HospitablePropertyCapacity | null
  bookings?: HospitablePropertyBookings | null
}

export interface HospitablePropertiesResponse {
  data?: HospitableProperty[]
  meta?: {
    current_page?: number
    last_page?: number
    total?: number
  }
  links?: {
    next?: string | null
  }
}

function getPat(): string | undefined {
  return process.env.HOSPITABLE_API_PAT?.trim() || undefined
}

export async function fetchListedProperties(): Promise<HospitableProperty[]> {
  const pat = getPat()
  if (!pat) {
    throw new Error('HOSPITABLE_API_PAT is not configured')
  }

  const properties: HospitableProperty[] = []
  let page = 1
  let lastPage = 1

  do {
    const url = new URL(`${HOSPITABLE_API_BASE}/v2/properties`)
    url.searchParams.set('include', 'bookings')
    url.searchParams.set('per_page', '100')
    url.searchParams.set('page', String(page))

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/json',
      },
      next: { revalidate: 3600 },
    })

    if (!response.ok) {
      throw new Error(`Hospitable API error: ${response.status}`)
    }

    const payload = (await response.json()) as HospitablePropertiesResponse
    const batch = payload.data ?? []
    properties.push(...batch.filter((property) => property.listed === true))

    lastPage = payload.meta?.last_page ?? page
    page += 1
  } while (page <= lastPage)

  return properties
}
