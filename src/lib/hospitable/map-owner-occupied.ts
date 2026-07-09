import type { CanaryOwnerOccupiedBlock, CanaryProperty } from '@/lib/canary/types'
import {
  STR_DEFAULT_CHECK_IN_HOUR,
  STR_DEFAULT_CHECK_IN_MINUTE,
  STR_DEFAULT_CHECK_OUT_HOUR,
  STR_DEFAULT_CHECK_OUT_MINUTE,
  resolveTimestampFromFields,
} from '@/lib/canary/timeline-times'
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
  if (!g) return 'Owner'
  const name = [
    (g.first_name ?? g.firstName ?? '').trim(),
    (g.last_name ?? g.lastName ?? '').trim(),
  ].filter(Boolean).join(' ').trim()
  return name || 'Owner'
}

function dateOnly(iso: string | undefined | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

/** True when Hospitable marks this reservation as an owner stay / manual owner block. */
export function isOwnerOccupiedReservation(reservation: HospitableReservation): boolean {
  if (reservation.owner_stay === true || reservation.ownerStay === true) return true
  const stayType = String(reservation.stay_type ?? reservation.stayType ?? '').toLowerCase()
  if (stayType.includes('owner')) return true
  const platform = String(reservation.platform ?? '').toLowerCase()
  const guest = guestLabel(reservation).toLowerCase()
  if (platform === 'manual' && (guest.includes('owner') || guest.includes('occupied'))) return true
  return false
}

export function mapOwnerOccupiedToTimeline(
  reservations: HospitableReservation[],
  hospitableProperties: HospitableProperty[],
  canaryProperties: CanaryProperty[]
): CanaryOwnerOccupiedBlock[] {
  const propertyById = new Map(hospitableProperties.map((p) => [p.id, p]))
  const addressByHospitableId = resolveHospitablePropertyAddresses(hospitableProperties, canaryProperties)
  const canaryByAddress = new Map(canaryProperties.map((p) => [p.address, p]))

  const blocks: CanaryOwnerOccupiedBlock[] = []

  for (const reservation of reservations) {
    if (!isOwnerOccupiedReservation(reservation)) continue
    const status = reservationStatus(reservation)
    if (status === 'cancelled' || status === 'not_accepted') continue

    const start = dateOnly(reservationArrival(reservation))
    const end = dateOnly(reservationDeparture(reservation))
    if (!start || !end) continue

    const checkInAt = resolveTimestampFromFields(
      [reservation.check_in, reservation.checkIn, reservation.arrival_date, reservation.arrivalDate],
      start,
      STR_DEFAULT_CHECK_IN_HOUR,
      STR_DEFAULT_CHECK_IN_MINUTE
    )
    const checkOutAt = resolveTimestampFromFields(
      [reservation.check_out, reservation.checkOut, reservation.departure_date, reservation.departureDate],
      end,
      STR_DEFAULT_CHECK_OUT_HOUR,
      STR_DEFAULT_CHECK_OUT_MINUTE
    )
    if (!checkInAt || !checkOutAt) continue

    const propertyId = reservationPropertyId(reservation)
    const hp = propertyId ? propertyById.get(propertyId) : undefined
    const propertyKey =
      (propertyId ? addressByHospitableId.get(propertyId) : undefined) ??
      (hp ? hospitablePropertyLabel(hp) : propertyId || reservation.id)
    const canaryProp = canaryByAddress.get(propertyKey)

    blocks.push({
      id: `hospitable:${reservation.id}`,
      property: propertyKey,
      propertyId: canaryProp?.id,
      hospitablePropertyId: propertyId || undefined,
      start,
      end,
      checkInAt,
      checkOutAt,
      notes: reservation.notes?.trim() ?? '',
      source: 'hospitable',
      guestLabel: guestLabel(reservation),
      hospitableReservationId: reservation.id,
    })
  }

  return blocks.sort((a, b) => a.start.localeCompare(b.start))
}
