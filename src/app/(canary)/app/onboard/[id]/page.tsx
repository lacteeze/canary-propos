import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getIntakeSubmissionForStaff } from '@/app/actions/intake'
import { getCaller } from '@/lib/canary/load-db'
import {
  ACCESS_LABELS,
  formatWhen,
  HEATING_LABELS,
  INTAKE_STATUS_LABELS,
  labelOf,
  LAUNDRY_LABELS,
  PANEL_LABELS,
  PETS_LABELS,
  PROPERTY_TYPE_LABELS,
  WATER_HEATER_LABELS,
  WHO_LABELS,
  YES_NO_UNSURE,
} from '@/components/intake/staff-labels'

export const dynamic = 'force-dynamic'

function isStaff(roles: string[]) {
  return roles.some((r) => ['manager', 'employee', 'admin'].includes(r))
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  const display = value === undefined || value === null || value === '' ? '—' : String(value)
  return (
    <div>
      <dt>{label}</dt>
      <dd>{display}</dd>
    </div>
  )
}

export default async function StaffOnboardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const caller = await getCaller()
  if (caller === 'no-user') redirect('/login')
  if (caller === 'no-person') redirect('/onboarding')
  if (!isStaff(caller.roles)) redirect('/app')

  const { id } = await params
  const result = await getIntakeSubmissionForStaff(id)

  if (!result.success) {
    return (
      <div className="sint-page">
        <header className="sint-bar">
          <h1>Client intake</h1>
          <Link href="/app/onboard">All submissions</Link>
        </header>
        <main className="sint-main">
          <p className="sint-error">{result.error}</p>
        </main>
      </div>
    )
  }

  const { submission, photoUrls } = result
  const p = submission.payload
  const contact = p.contact
  const property = p.property
  const details = p.details
  const units = p.units ?? []
  const utilities = p.utilities
  const resp = p.responsibilities

  return (
    <div className="sint-page">
      <header className="sint-bar">
        <h1>{submission.contact_name || 'Untitled intake'}</h1>
        <Link href="/app/onboard">All submissions</Link>
      </header>
      <main className="sint-main">
        <section className="sint-card">
          <h2>Submission</h2>
          <dl className="sint-dl">
            <Row label="Status" value={INTAKE_STATUS_LABELS[submission.status]} />
            <Row label="Step" value={`${submission.current_step} / 7`} />
            <Row label="Created" value={formatWhen(submission.created_at)} />
            <Row label="Updated" value={formatWhen(submission.updated_at)} />
            <Row label="Submitted" value={formatWhen(submission.submitted_at)} />
          </dl>
        </section>

        <section className="sint-card">
          <h2>Contact</h2>
          <dl className="sint-dl">
            <Row label="Name" value={contact?.full_name} />
            <Row label="Email" value={contact?.email} />
            <Row label="Phone" value={contact?.phone} />
            <Row label="How heard" value={contact?.how_heard} />
          </dl>
        </section>

        <section className="sint-card">
          <h2>Property</h2>
          <dl className="sint-dl">
            <Row label="Address" value={submission.property_address} />
            <Row label="Street" value={property?.street_address} />
            <Row label="City" value={property?.city} />
            <Row label="Province" value={property?.province} />
            <Row label="Postal" value={property?.postal_code} />
            <Row
              label="Type"
              value={property?.property_type ? labelOf(PROPERTY_TYPE_LABELS, property.property_type) : undefined}
            />
            <Row label="Units" value={property?.unit_count} />
          </dl>
        </section>

        <section className="sint-card">
          <h2>Building details</h2>
          <dl className="sint-dl">
            <Row label="Year built" value={details?.year_built} />
            <Row label="Storeys" value={details?.storeys} />
            <Row
              label="Heat"
              value={details?.heating_type ? labelOf(HEATING_LABELS, details.heating_type) : undefined}
            />
            <Row
              label="Water heater"
              value={details?.water_heater_type ? labelOf(WATER_HEATER_LABELS, details.water_heater_type) : undefined}
            />
            <Row label="Water heater age" value={details?.water_heater_age} />
            <Row
              label="Firewall"
              value={details?.has_firewall ? labelOf(YES_NO_UNSURE, details.has_firewall) : undefined}
            />
            <Row label="Roof year" value={details?.roof_year} />
            <Row
              label="Panel"
              value={details?.electrical_panel ? labelOf(PANEL_LABELS, details.electrical_panel) : undefined}
            />
            <Row label="Oil tank year" value={details?.oil_tank_year} />
          </dl>
        </section>

        {units.map((unit, index) => (
          <section className="sint-card" key={index}>
            <h2>{unit.unit_label || `Unit ${index + 1}`}</h2>
            <dl className="sint-dl">
              <Row label="Beds" value={unit.beds} />
              <Row label="Baths" value={unit.baths} />
              <Row label="Sq ft" value={unit.sqft} />
              <Row label="Target rent" value={unit.target_rent} />
              <Row label="Occupancy" value={unit.occupancy_status} />
              <Row label="Laundry" value={unit.laundry ? labelOf(LAUNDRY_LABELS, unit.laundry) : undefined} />
              <Row label="Parking" value={unit.parking_spaces} />
              <Row label="Pets" value={unit.pets_allowed ? labelOf(PETS_LABELS, unit.pets_allowed) : undefined} />
              <Row label="Furnished" value={unit.furnished} />
              <Row label="Tenant name" value={unit.existing_tenant_name} />
              <Row label="Tenant email" value={unit.existing_tenant_email} />
              <Row label="Tenant phone" value={unit.existing_tenant_phone} />
              <Row label="Current rent" value={unit.current_rent} />
              <Row label="Lease type" value={unit.lease_type} />
              <Row label="Lease end" value={unit.lease_end_date} />
              <Row label="Deposit held" value={unit.deposit_held} />
              <Row label="Deposit holder" value={unit.deposit_holder} />
              <Row label="Expected move-out" value={unit.expected_move_out} />
            </dl>
          </section>
        ))}

        <section className="sint-card">
          <h2>Utilities</h2>
          <dl className="sint-dl">
            <Row
              label="Separately metered"
              value={
                utilities?.separately_metered
                  ? labelOf(YES_NO_UNSURE, utilities.separately_metered)
                  : undefined
              }
            />
            {(utilities?.units ?? []).map((unit, index) => (
              <Row
                key={index}
                label={`Unit ${index + 1} included`}
                value={`heat ${unit.heat_included_in_rent ?? '—'} · lights ${unit.light_included_in_rent ?? '—'} · water ${unit.water_included_in_rent ?? '—'} · internet ${unit.internet_included_in_rent ?? '—'}`}
              />
            ))}
          </dl>
        </section>

        <section className="sint-card">
          <h2>Responsibilities</h2>
          <dl className="sint-dl">
            <Row label="Garbage" value={resp?.garbage_responsibility ? labelOf(WHO_LABELS, resp.garbage_responsibility) : undefined} />
            <Row label="Lawn" value={resp?.lawn_responsibility ? labelOf(WHO_LABELS, resp.lawn_responsibility) : undefined} />
            <Row label="Snow" value={resp?.snow_responsibility ? labelOf(WHO_LABELS, resp.snow_responsibility) : undefined} />
            <Row label="Access" value={resp?.access_method ? labelOf(ACCESS_LABELS, resp.access_method) : undefined} />
            <Row label="Notes" value={resp?.notes} />
          </dl>
        </section>

        <section className="sint-card">
          <h2>Photos</h2>
          {photoUrls.length === 0 ? (
            <p style={{ color: '#6b6256', marginTop: 0 }}>No photos uploaded.</p>
          ) : (
            <div className="sint-photos">
              {photoUrls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="Intake upload" />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
