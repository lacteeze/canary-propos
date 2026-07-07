import {
  fetchAllProperties,
  fetchReservations,
  isHospitableConfigured,
} from '@/lib/hospitable/client'
import { mapReservationsToTimeline } from '@/lib/hospitable/map-reservations'
import type { CanaryProperty, HospitableCalendarData } from './types'

const PAST_DAYS = 30
const FUTURE_DAYS = 540

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function dateWindow(): { startDate: string; endDate: string } {
  const now = new Date()
  const start = new Date(now.getTime() - PAST_DAYS * 864e5)
  const end = new Date(now.getTime() + FUTURE_DAYS * 864e5)
  return { startDate: formatDate(start), endDate: formatDate(end) }
}

const emptyCalendar = (message: string): HospitableCalendarData => ({
  strBookings: [],
  connected: false,
  statusMessage: message,
  propertyCount: 0,
})

export async function loadHospitableCalendar(
  canaryProperties: CanaryProperty[]
): Promise<HospitableCalendarData> {
  if (!isHospitableConfigured()) {
    return emptyCalendar('Add HOSPITABLE_API_PAT to show Airbnb / STR bookings on the timeline.')
  }

  try {
    const properties = await fetchAllProperties()
    if (!properties.length) {
      return {
        strBookings: [],
        connected: true,
        statusMessage: 'Hospitable connected — no properties found.',
        propertyCount: 0,
      }
    }

    const { startDate, endDate } = dateWindow()
    const reservations = await fetchReservations({
      propertyIds: properties.map((p) => p.id),
      startDate,
      endDate,
    })

    const strBookings = mapReservationsToTimeline(
      reservations,
      properties,
      canaryProperties
    )

    return {
      strBookings,
      connected: true,
      statusMessage: `${strBookings.length} STR stay${strBookings.length === 1 ? '' : 's'} · ${properties.length} Hospitable propert${properties.length === 1 ? 'y' : 'ies'}`,
      propertyCount: properties.length,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Hospitable fetch failed'
    console.error('[loadHospitableCalendar]', error)
    return emptyCalendar(`Hospitable unavailable (${msg}). Leases timeline shows Supabase data only.`)
  }
}
