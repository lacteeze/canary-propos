import {
  fetchAllProperties,
  fetchReservations,
  isHospitableConfigured,
  type HospitableProperty,
} from '@/lib/hospitable/client'
import { mapOwnerOccupiedToTimeline } from '@/lib/hospitable/map-owner-occupied'
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
  ownerOccupiedBlocks: [],
  connected: false,
  statusMessage: message,
  propertyCount: 0,
})

export async function loadHospitableCalendar(
  canaryProperties: CanaryProperty[],
  /** Optional pre-fetched Hospitable properties (avoids a second /v2/properties round-trip). */
  hospitableProperties?: HospitableProperty[]
): Promise<HospitableCalendarData> {
  if (!isHospitableConfigured()) {
    return emptyCalendar('Add HOSPITABLE_API_PAT to show Airbnb / STR bookings on the timeline.')
  }

  try {
    const properties = hospitableProperties ?? (await fetchAllProperties())
    if (!properties.length) {
      return {
        strBookings: [],
        ownerOccupiedBlocks: [],
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
    const ownerOccupiedBlocks = mapOwnerOccupiedToTimeline(
      reservations,
      properties,
      canaryProperties
    )

    const ownerPart =
      ownerOccupiedBlocks.length > 0
        ? ` · ${ownerOccupiedBlocks.length} owner stay${ownerOccupiedBlocks.length === 1 ? '' : 's'}`
        : ''

    return {
      strBookings,
      ownerOccupiedBlocks,
      connected: true,
      statusMessage: `${strBookings.length} STR stay${strBookings.length === 1 ? '' : 's'}${ownerPart} · ${properties.length} Hospitable propert${properties.length === 1 ? 'y' : 'ies'}`,
      propertyCount: properties.length,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Hospitable fetch failed'
    console.error('[loadHospitableCalendar]', error)
    const authHint =
      /\b401\b/.test(msg)
        ? ' Check that HOSPITABLE_API_PAT in Vercel Production matches a valid Hospitable Personal Access Token, then redeploy.'
        : ''
    return emptyCalendar(
      `Hospitable unavailable (${msg}).${authHint} Leases timeline shows Supabase data only.`
    )
  }
}
