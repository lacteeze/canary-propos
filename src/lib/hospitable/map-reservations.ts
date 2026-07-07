import type { CanaryProperty, CanaryStrBooking } from '@/lib/canary/types'
import type { HospitableProperty, HospitableReservation } from './client'
import { resolveHospitablePropertyAddresses } from './match-property'
import { hospitablePropertyLabel } from './property-label'

function reservationStatus(reservation: HospitableReservation): string {
  return (
    reservation.reservation_status?.current?.category ??
    reservation.reservationStatus?.current?.category ??
    reservation.status ??
    'unknown'
  )
}

function reservationArrival(reservation: HospitableReservation): string | null | undefined {
  return (
    reservation.arrival_date ??
    reservation.arrivalDate ??
    reservation.check_in ??
    reservation.checkIn
  )
}

function reservationDeparture(reservation: HospitableReservation): string | null | undefined {
  return (
    reservation.departure_date ??
    reservation.departureDate ??
    reservation.check_out ??
    reservation.checkOut
  )
}

function reservationPropertyId(reservation: HospitableReservation): string {
  const embedded = reservation.properties?.[0]
  if (typeof embedded === 'object' && embedded && 'id' in embedded && embedded.id) {
    return String(embedded.id)
  }
  return reservation.property_id ?? reservation.propertyId ?? ''
}

function guestLabel(reservation: HospitableReservation): string {
  const g = reservation.guest
  if (!g) return 'Guest'
  const name = [g.firstName, g.lastName].filter(Boolean).join(' ').trim()
  return name || 'Guest'
}

function dateOnly(iso: string | undefined | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function platformLabel(platform: string | undefined | null): string {
  if (!platform) return 'Direct'
  const p = platform.toLowerCase()
  if (p.includes('airbnb')) return 'Airbnb'
  if (p.includes('vrbo') || p.includes('homeaway')) return 'VRBO'
  if (p.includes('booking')) return 'Booking.com'
  return platform
}

/** @deprecated Use resolveHospitablePropertyAddresses from match-property.ts */
export { matchHospitableToCanaryAddress } from './match-property'

export function mapReservationsToTimeline(
  reservations: HospitableReservation[],
  hospitableProperties: HospitableProperty[],
  canaryProperties: CanaryProperty[]
): CanaryStrBooking[] {
  const propertyById = new Map(hospitableProperties.map((p) => [p.id, p]))
  const addressByHospitableId = resolveHospitablePropertyAddresses(hospitableProperties, canaryProperties)

  const bookings: CanaryStrBooking[] = []

  for (const reservation of reservations) {
    const status = reservationStatus(reservation)
    if (status === 'cancelled' || status === 'not_accepted') continue

    const start = dateOnly(reservationArrival(reservation))
    const end = dateOnly(reservationDeparture(reservation))
    if (!start || !end) continue

    const embeddedProperty = reservation.properties?.[0]
    const propertyId = reservationPropertyId(reservation)

    const hp = propertyId ? propertyById.get(propertyId) : undefined
    const propertyKey =
      (propertyId ? addressByHospitableId.get(propertyId) : undefined) ??
      (hp ? hospitablePropertyLabel(hp) : hospitablePropertyLabel({
          id: propertyId || reservation.id,
          public_name: embeddedProperty && typeof embeddedProperty === 'object' && 'public_name' in embeddedProperty
            ? String((embeddedProperty as { public_name?: string }).public_name ?? '')
            : undefined,
          name: embeddedProperty && typeof embeddedProperty === 'object' && 'name' in embeddedProperty
            ? String((embeddedProperty as { name?: string }).name ?? '')
            : undefined,
          address:
            embeddedProperty && typeof embeddedProperty === 'object' && 'address' in embeddedProperty
              ? (embeddedProperty as { address?: HospitableProperty['address'] }).address
              : undefined,
        }))

    bookings.push({
      id: reservation.id,
      property: propertyKey,
      hospitablePropertyId: propertyId,
      hospitablePropertyName: hp ? hospitablePropertyLabel(hp) : propertyKey,
      start,
      end,
      guestLabel: guestLabel(reservation),
      platform: platformLabel(reservation.platform),
      status,
      nights: reservation.nights ?? null,
      code: reservation.code ?? '',
    })
  }

  return bookings.sort((a, b) => a.start.localeCompare(b.start))
}
