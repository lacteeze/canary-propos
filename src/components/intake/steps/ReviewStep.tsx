'use client'

import { useState, type ReactNode } from 'react'
import {
  HEATING_LABELS,
  LAUNDRY_LABELS,
  PANEL_LABELS,
  PETS_LABELS,
  PROPERTY_TYPE_LABELS,
  STEP_TITLES,
  WATER_HEATER_LABELS,
  YES_NO_UNSURE,
  type IntakePayload,
} from '@/lib/intake/schema'

function Row({ label, value }: { label: string; value?: string | number | null }) {
  const display = value === undefined || value === null || value === '' ? '—' : String(value)
  return (
    <div>
      <dt>{label}</dt>
      <dd>{display}</dd>
    </div>
  )
}

function Block({
  step,
  title,
  onEdit,
  children,
}: {
  step: number
  title: string
  onEdit: (step: number) => void
  children: ReactNode
}) {
  return (
    <section className="cint-summary-block">
      <div className="cint-summary-head">
        <h3>
          {step}. {title}
        </h3>
        <button type="button" onClick={() => onEdit(step)} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1a2f5c' }}>
          Edit
        </button>
      </div>
      <dl className="cint-dl">{children}</dl>
    </section>
  )
}

export function ReviewStepForm({
  payload,
  onBack,
  onEdit,
  onUpload,
  onSubmit,
  isSaving,
}: {
  payload: IntakePayload
  onBack: () => void
  onEdit: (step: number) => void
  onUpload: (files: FileList) => Promise<void>
  onSubmit: () => Promise<void>
  isSaving: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const contact = payload.contact
  const property = payload.property
  const details = payload.details
  const units = payload.units ?? []
  const utilities = payload.utilities
  const resp = payload.responsibilities
  const photos = payload.photos?.paths ?? []

  return (
    <div className="cpub-form-card">
      <h2>Photos and review</h2>
      <p className="cpub-form-sub">Optional photos, then send it in. You can edit any step.</p>

      <FieldUpload
        count={photos.length}
        disabled={isSaving || uploading}
        onChange={async (files) => {
          if (!files?.length) return
          setUploading(true)
          try {
            await onUpload(files)
          } finally {
            setUploading(false)
          }
        }}
      />

      <Block step={1} title={STEP_TITLES[0]} onEdit={onEdit}>
        <Row label="Name" value={contact?.full_name} />
        <Row label="Email" value={contact?.email} />
        <Row label="Phone" value={contact?.phone} />
        <Row label="How heard" value={contact?.how_heard} />
      </Block>

      <Block step={2} title={STEP_TITLES[1]} onEdit={onEdit}>
        <Row label="Address" value={property?.street_address} />
        <Row label="City" value={property?.city} />
        <Row label="Province" value={property?.province} />
        <Row label="Postal" value={property?.postal_code} />
        <Row
          label="Type"
          value={property?.property_type ? PROPERTY_TYPE_LABELS[property.property_type] : undefined}
        />
        <Row label="Units" value={property?.unit_count} />
      </Block>

      <Block step={3} title={STEP_TITLES[2]} onEdit={onEdit}>
        <Row label="Year built" value={details?.year_built} />
        <Row label="Storeys" value={details?.storeys} />
        <Row label="Heat" value={details?.heating_type ? HEATING_LABELS[details.heating_type] : undefined} />
        <Row
          label="Water heater"
          value={details?.water_heater_type ? WATER_HEATER_LABELS[details.water_heater_type] : undefined}
        />
        <Row label="Water heater age" value={details?.water_heater_age} />
        <Row label="Firewall" value={details?.has_firewall ? YES_NO_UNSURE[details.has_firewall] : undefined} />
        <Row label="Roof year" value={details?.roof_year} />
        <Row label="Panel" value={details?.electrical_panel ? PANEL_LABELS[details.electrical_panel] : undefined} />
        <Row label="Oil tank year" value={details?.oil_tank_year} />
      </Block>

      <Block step={4} title={STEP_TITLES[3]} onEdit={onEdit}>
        {units.length === 0 ? <Row label="Units" value="None yet" /> : null}
        {units.map((u, i) => (
          <Row
            key={i}
            label={u.unit_label || `Unit ${i + 1}`}
            value={`${u.beds ?? '—'} bed / ${u.baths ?? '—'} bath · ${u.occupancy_status ?? '—'} · laundry ${u.laundry ? LAUNDRY_LABELS[u.laundry] : '—'} · pets ${u.pets_allowed ? PETS_LABELS[u.pets_allowed] : '—'}`}
          />
        ))}
      </Block>

      <Block step={5} title={STEP_TITLES[4]} onEdit={onEdit}>
        <Row
          label="Separately metered"
          value={utilities?.separately_metered ? YES_NO_UNSURE[utilities.separately_metered] : undefined}
        />
        {(utilities?.units ?? []).map((u, i) => (
          <Row
            key={i}
            label={`Unit ${i + 1} included`}
            value={`heat ${u.heat_included_in_rent ?? '—'} · lights ${u.light_included_in_rent ?? '—'} · water ${u.water_included_in_rent ?? '—'} · internet ${u.internet_included_in_rent ?? '—'}`}
          />
        ))}
      </Block>

      <Block step={6} title={STEP_TITLES[5]} onEdit={onEdit}>
        <Row label="Garbage" value={resp?.garbage_responsibility} />
        <Row label="Lawn" value={resp?.lawn_responsibility} />
        <Row label="Snow" value={resp?.snow_responsibility} />
        <Row label="Access" value={resp?.access_method} />
        <Row label="Notes" value={resp?.notes} />
      </Block>

      <div className="cint-nav">
        <button type="button" className="cpub-btn-outline" onClick={onBack} disabled={isSaving}>
          Back
        </button>
        <button type="button" className="cpub-btn-primary" onClick={() => void onSubmit()} disabled={isSaving}>
          {isSaving ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </div>
  )
}

function FieldUpload({
  count,
  disabled,
  onChange,
}: {
  count: number
  disabled: boolean
  onChange: (files: FileList | null) => void
}) {
  return (
    <div className="cpub-field" style={{ marginBottom: 18 }}>
      <label>Property photos (optional)</label>
      <input
        className="cint-file"
        type="file"
        accept="image/*"
        multiple
        disabled={disabled}
        onChange={(e) => onChange(e.target.files)}
      />
      <p className="cpub-form-sub" style={{ marginTop: 8, marginBottom: 0 }}>
        {count === 0 ? 'No photos yet.' : `${count} photo${count === 1 ? '' : 's'} attached.`}
      </p>
    </div>
  )
}
