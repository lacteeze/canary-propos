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
  /** camelCase aliases — API returns snake_case `first_name` / `last_name` */
  firstName?: string | null
  lastName?: string | null
  first_name?: string | null
  last_name?: string | null
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
  /** True when Hospitable classifies this as an owner stay */
  ownerStay?: boolean | null
  owner_stay?: boolean | null
  stayType?: string | null
  stay_type?: string | null
  notes?: string | null
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
  const raw = process.env.HOSPITABLE_API_PAT?.trim()
  if (!raw) return undefined
  // Strip accidental wrapping quotes from dashboard / CLI paste
  const unquoted =
    (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))
      ? raw.slice(1, -1).trim()
      : raw
  return unquoted || undefined
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

export interface HospitableTaskProperty {
  id?: string
  name?: string | null
}

export interface HospitableTaskReservation {
  id?: string
  code?: string | null
}

export interface HospitableTaskTeammate {
  id?: string
  name?: string | null
}

export interface HospitableTaskAssignment {
  status?: string | null
  updated_at?: string | null
}

export interface HospitableTask {
  id: string
  name?: string | null
  note?: string | null
  task_type?: number | null
  service_id?: number | null
  start_date?: string | null
  end_date?: string | null
  timezone?: string | null
  duration_hours?: number | null
  progress_status?: string | null
  task_assignment?: HospitableTaskAssignment | null
  property?: HospitableTaskProperty | null
  reservation?: HospitableTaskReservation | null
  teammate?: HospitableTaskTeammate | null
}

export interface HospitableTasksResponse {
  data?: HospitableTask[]
  meta?: {
    current_page?: number
    last_page?: number
    total?: number
    task_types?: Record<string, { label?: string; service_id?: number }>
    service_types?: Record<string, { label?: string }>
    assignment_statuses?: Record<string, { label?: string }>
    progress_statuses?: Record<string, { label?: string }>
  }
}

export interface FetchTasksParams {
  propertyIds: string[]
  /** Inclusive YYYY-MM-DD window on task start (optional) */
  startDate?: string
  endDate?: string
}

/** Max property IDs per /v2/tasks request to keep query strings reasonable. */
const TASKS_PROPERTY_CHUNK = 40

export async function fetchTasks(params: FetchTasksParams): Promise<{
  tasks: HospitableTask[]
  taskTypeLabels: Record<number, string>
}> {
  const { propertyIds, startDate, endDate } = params
  if (!propertyIds.length) return { tasks: [], taskTypeLabels: {} }

  const tasks: HospitableTask[] = []
  const taskTypeLabels: Record<number, string> = {}

  for (let i = 0; i < propertyIds.length; i += TASKS_PROPERTY_CHUNK) {
    const chunk = propertyIds.slice(i, i + TASKS_PROPERTY_CHUNK)
    let page = 1
    let lastPage = 1

    do {
      const url = new URL(`${HOSPITABLE_API_BASE}/v2/tasks`)
      for (const id of chunk) {
        url.searchParams.append('properties[]', id)
      }
      if (startDate) url.searchParams.set('start_date', startDate)
      if (endDate) url.searchParams.set('end_date', endDate)
      url.searchParams.set('per_page', '100')
      url.searchParams.set('page', String(page))

      const payload = await hospitableFetch<HospitableTasksResponse>(url)
      tasks.push(...(payload.data ?? []))

      const types = payload.meta?.task_types
      if (types) {
        for (const [key, value] of Object.entries(types)) {
          const n = Number(key)
          if (!Number.isNaN(n) && value?.label) taskTypeLabels[n] = value.label
        }
      }

      lastPage = payload.meta?.last_page ?? page
      page += 1
    } while (page <= lastPage)
  }

  return { tasks, taskTypeLabels }
}
