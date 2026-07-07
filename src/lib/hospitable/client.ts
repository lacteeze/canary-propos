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

export interface HospitableGuest {
  firstName?: string | null
  lastName?: string | null
}

export interface HospitableReservation {
  id: string
  code?: string | null
  platform?: string | null
  /** camelCase alias — API returns snake_case `property_id` */
  propertyId?: string | null
  property_id?: string | null
  /** camelCase aliases — API returns snake_case `arrival_date` / `departure_date` */
  arrivalDate?: string | null
  departureDate?: string | null
  checkIn?: string | null
  checkOut?: string | null
  arrival_date?: string | null
  departure_date?: string | null
  check_in?: string | null
  check_out?: string | null
  nights?: number | null
  status?: string | null
  reservationStatus?: {
    current?: { category?: string | null; subCategory?: string | null }
  } | null
  reservation_status?: {
    current?: { category?: string | null; sub_category?: string | null }
  } | null
  guest?: HospitableGuest | null
  properties?: Array<{
    id?: string
    name?: string | null
    public_name?: string | null
    address?: HospitablePropertyAddress | null
  }> | null
}

export interface HospitableReservationsResponse {
  data?: HospitableReservation[]
  meta?: {
    current_page?: number
    last_page?: number
    total?: number
  }
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

export function isHospitableConfigured(): boolean {
  return !!getPat()
}

async function hospitableFetch<T>(url: URL, init?: RequestInit): Promise<T> {
  const pat = getPat()
  if (!pat) throw new Error('HOSPITABLE_API_PAT is not configured')

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    next: { revalidate: 900 },
  })

  if (!response.ok) {
    throw new Error(`Hospitable API error: ${response.status}`)
  }

  return (await response.json()) as T
}

async function fetchPropertiesPages(listedOnly: boolean): Promise<HospitableProperty[]> {
  const properties: HospitableProperty[] = []
  let page = 1
  let lastPage = 1

  do {
    const url = new URL(`${HOSPITABLE_API_BASE}/v2/properties`)
    url.searchParams.set('include', 'bookings')
    url.searchParams.set('per_page', '100')
    url.searchParams.set('page', String(page))

    const payload = await hospitableFetch<HospitablePropertiesResponse>(url)
    const batch = payload.data ?? []
    properties.push(...(listedOnly ? batch.filter((property) => property.listed === true) : batch))

    lastPage = payload.meta?.last_page ?? page
    page += 1
  } while (page <= lastPage)

  return properties
}

export async function fetchListedProperties(): Promise<HospitableProperty[]> {
  if (!getPat()) throw new Error('HOSPITABLE_API_PAT is not configured')
  return fetchPropertiesPages(true)
}

/** All Hospitable properties (listed + unlisted) for operational calendar overlay. */
export async function fetchAllProperties(): Promise<HospitableProperty[]> {
  if (!getPat()) throw new Error('HOSPITABLE_API_PAT is not configured')
  return fetchPropertiesPages(false)
}

export interface FetchReservationsParams {
  propertyIds: string[]
  startDate: string
  endDate: string
  /** accepted | request | … — defaults to accepted + request */
  statuses?: string[]
}

export async function fetchReservations(params: FetchReservationsParams): Promise<HospitableReservation[]> {
  const { propertyIds, startDate, endDate, statuses = ['accepted', 'request'] } = params
  if (!propertyIds.length) return []

  const reservations: HospitableReservation[] = []
  let page = 1
  let lastPage = 1

  do {
    const url = new URL(`${HOSPITABLE_API_BASE}/v2/reservations`)
    for (const id of propertyIds) {
      url.searchParams.append('properties[]', id)
    }
    url.searchParams.set('start_date', startDate)
    url.searchParams.set('end_date', endDate)
    url.searchParams.set('date_query', 'checkin')
    url.searchParams.set('include', 'guest,properties')
    url.searchParams.set('per_page', '100')
    url.searchParams.set('page', String(page))
    for (const status of statuses) {
      url.searchParams.append('status[]', status)
    }

    const payload = await hospitableFetch<HospitableReservationsResponse>(url)
    reservations.push(...(payload.data ?? []))

    lastPage = payload.meta?.last_page ?? page
    page += 1
  } while (page <= lastPage)

  return reservations
}
