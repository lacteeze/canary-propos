'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  activateDraftListing,
  deleteDraftListing,
  saveDraftListing,
} from '@/app/actions/canary'
import { generateListingDescription } from '@/app/actions/listing-ai'
import { moneyCad, propertyHref, shortAddress } from '@/lib/canary/entity-href'
import { addMonthsToIsoDate, validateLeaseDates, type LeaseTermType } from '@/lib/canary/lease-term'
import type { CanaryDb, CanaryDraft, DraftListingStatus } from '@/lib/canary/types'
import { draftStatusBadge } from '@/lib/canary/types'
import { listingPublicHref } from '@/lib/listings/listing-href'
import DatePickerField from './DatePickerField'
import { CopyPublicLinkButton } from './CopyPublicLinkButton'
import { EntityBackButton, EntityPageShell, useEntityBack, type EntityChrome } from './EntityPageShell'

const DRAFT_RENT_STEP = 25

function rentNum(r: string | null | undefined): number {
  const n = parseFloat(String(r || '').replace(/[$,]/g, ''))
  return Number.isNaN(n) ? 0 : n
}

export default function ListingDetailPage({
  id,
  db,
  canEdit,
  chrome,
}: {
  id: string
  db: CanaryDb
  canEdit: boolean
  chrome: EntityChrome
}) {
  const router = useRouter()
  const goBack = useEntityBack('/app')
  const listing = db.drafts.find((d) => d.id === id)
  const property = listing
    ? db.properties.find((p) => p.id === listing.propId || p.id === listing.unitId)
    : undefined

  const [form, setForm] = useState(() => listingToForm(listing))
  const [endDirty, setEndDirty] = useState(Boolean((listing?.end || '').trim()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [descGenerating, setDescGenerating] = useState(false)

  const badge = listing ? draftStatusBadge(listing.status) : null
  const publicHref = listing
    ? listingPublicHref({ id: listing.id, slug: listing.slug }, '')
    : null
  const canActivate =
    !!form.propId &&
    !!form.start &&
    rentNum(form.rent) > 0 &&
    (form.termType === 'month_to_month' || !!form.end)

  const setField = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const adjustRent = (delta: number) => {
    const next = Math.max(0, rentNum(form.rent) + delta)
    setForm((prev) => ({ ...prev, rent: next > 0 ? String(next) : '' }))
  }

  const submit = async () => {
    if (!form.propId || saving || !canEdit) return
    setSaving(true)
    setError('')
    const res = await saveDraftListing({
      id: form.id,
      unitId: form.propId,
      rent: form.rent === '' ? null : rentNum(form.rent),
      rentalCredit: form.rentalCredit === '' ? null : rentNum(form.rentalCredit),
      rentalCreditExpiry: form.rentalCreditExpiry || null,
      start: form.start || null,
      description: form.description || null,
      pets: form.pets,
      utilities: form.utilities,
      status: form.status,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.error ?? 'Could not save listing.')
      return
    }
    goBack()
  }

  const remove = async () => {
    if (!form.id || saving || !canEdit) return
    if (!window.confirm('Delete this listing? This cannot be undone.')) return
    setSaving(true)
    const res = await deleteDraftListing(form.id)
    setSaving(false)
    if (!res.success) {
      setError(res.error ?? 'Could not delete listing.')
      return
    }
    goBack()
  }

  const activate = async () => {
    if (!form.propId || saving || !canEdit) return
    if (!form.start) {
      setError('Start date is required to activate a lease.')
      return
    }
    const rent = rentNum(form.rent)
    if (!rent || rent <= 0) {
      setError('Monthly rent is required to activate a lease.')
      return
    }
    const dateErr = validateLeaseDates(form.termType, form.start, form.end || null)
    if (dateErr) {
      setError(dateErr)
      return
    }
    setSaving(true)
    setError('')
    const res = await activateDraftListing({
      listingId: form.id,
      unitId: form.propId,
      tenantId: form.tenantId || null,
      startDate: form.start,
      endDate: form.end || null,
      monthlyRent: rent,
      rentalCredit: form.rentalCredit === '' ? null : rentNum(form.rentalCredit),
      rentalCreditExpiry: form.rentalCreditExpiry || null,
      termType: form.termType,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.error ?? 'Could not activate listing.')
      return
    }
    goBack()
  }

  if (!listing) {
    return (
      <EntityPageShell chrome={chrome} activeView="leases" pageTitle="Listing">
        <div className="cy-entity-page-head">
          <EntityBackButton onClick={goBack} />
          <div className="cy-entity-page-title-block">
            <div style={{ fontWeight: 700, fontSize: 17 }}>Listing not found</div>
          </div>
        </div>
      </EntityPageShell>
    )
  }

  const title = listing.title?.trim() && listing.title !== listing.address
    ? listing.title
    : shortAddress(listing.address) || 'Listing'

  return (
    <EntityPageShell chrome={chrome} activeView="leases" pageTitle={title}>
      <div className="cy-entity-page-head">
        <EntityBackButton onClick={goBack} />
        <div className="cy-entity-page-title-block">
          <div className="cy-eyebrow" style={{ marginBottom: 3 }}>Listing</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-.01em' }}>{title}</div>
            {badge ? (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 6,
                  color: badge.color,
                  border: '1px solid var(--border)',
                  background: 'var(--elev)',
                }}
              >
                {badge.label === 'PUBLIC' ? 'Published' : badge.label}
              </span>
            ) : null}
          </div>
          <div style={{ color: 'var(--dim)', fontSize: 13, marginTop: 2 }}>
            {listing.address}
            {listing.rent ? ` · ${moneyCad(rentNum(listing.rent))}/mo` : ''}
          </div>
        </div>
      </div>

      <div className="cy-entity-page-body">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {property ? (
            <button
              type="button"
              className="cy-btn"
              onClick={() => router.push(propertyHref(property.id))}
            >
              Open property
            </button>
          ) : null}
          {listing.slug ? (
            <CopyPublicLinkButton slug={listing.slug} />
          ) : publicHref ? (
            <a href={publicHref} target="_blank" rel="noopener noreferrer" className="cy-btn">
              Open public page ↗
            </a>
          ) : null}
        </div>

        <div className="cy-entity-form-grid">
          <label>
            <span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Monthly rent</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => adjustRent(-DRAFT_RENT_STEP)}
                aria-label={`Decrease rent by $${DRAFT_RENT_STEP}`}
                style={stepBtnStyle}
              >
                −
              </button>
              <input
                value={form.rent}
                disabled={!canEdit}
                onChange={setField('rent')}
                style={fieldStyle}
              />
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => adjustRent(DRAFT_RENT_STEP)}
                aria-label={`Increase rent by $${DRAFT_RENT_STEP}`}
                style={stepBtnStyle}
              >
                +
              </button>
            </div>
          </label>
          <label>
            <span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Rental credit</span>
            <input
              value={form.rentalCredit}
              disabled={!canEdit}
              onChange={setField('rentalCredit')}
              inputMode="decimal"
              placeholder="0"
              style={{ ...fieldStyle, marginTop: 4 }}
            />
          </label>
          <label>
            <span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Credit expires</span>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <DatePickerField
                  value={form.rentalCreditExpiry}
                  onChange={(v) => {
                    if (!canEdit) return
                    setForm((prev) => ({ ...prev, rentalCreditExpiry: v }))
                  }}
                  placeholder="Optional expiry"
                />
              </div>
              {canEdit && form.rentalCreditExpiry ? (
                <button
                  type="button"
                  className="cy-btn-ghost"
                  onClick={() => setForm((prev) => ({ ...prev, rentalCreditExpiry: '' }))}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </label>
          <label>
            <span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Available / start</span>
            <div style={{ marginTop: 4 }}>
              <DatePickerField
                value={form.start}
                onChange={(v) => {
                  if (!canEdit) return
                  setForm((prev) => ({
                    ...prev,
                    start: v,
                    end: !endDirty ? (v ? addMonthsToIsoDate(v, 12) || '' : '') : prev.end,
                  }))
                }}
                placeholder="Pick start date"
              />
            </div>
          </label>
          <label>
            <span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Term type</span>
            <select
              className="cy-select cy-select--field"
              value={form.termType}
              disabled={!canEdit}
              onChange={(e) => setForm((prev) => ({ ...prev, termType: e.target.value as LeaseTermType }))}
              style={{ marginTop: 4, width: '100%' }}
            >
              <option value="fixed_term">Fixed term</option>
              <option value="month_to_month">Month-to-month</option>
            </select>
          </label>
          <label>
            <span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>
              Lease end{form.termType === 'month_to_month' ? ' (optional)' : ''}
            </span>
            <div style={{ marginTop: 4 }}>
              <DatePickerField
                value={form.end}
                onChange={(v) => {
                  if (!canEdit) return
                  setEndDirty(true)
                  setForm((prev) => ({ ...prev, end: v }))
                }}
                placeholder={form.termType === 'month_to_month' ? 'Optional end date' : 'Pick end date'}
              />
            </div>
          </label>
          <label>
            <span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Beds</span>
            <input value={form.beds} disabled={!canEdit} onChange={setField('beds')} style={{ ...fieldStyle, marginTop: 4 }} />
          </label>
          <label>
            <span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Baths</span>
            <input value={form.baths} disabled={!canEdit} onChange={setField('baths')} style={{ ...fieldStyle, marginTop: 4 }} />
          </label>
          <label>
            <span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Parking</span>
            <input value={form.parking} disabled={!canEdit} onChange={setField('parking')} style={{ ...fieldStyle, marginTop: 4 }} />
          </label>
          <label>
            <span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Pets</span>
            <select className="cy-select cy-select--field" value={form.pets} disabled={!canEdit} onChange={setField('pets')} style={{ marginTop: 4, width: '100%' }}>
              <option>No pets</option>
              <option>Pet friendly</option>
              <option>Dog friendly</option>
              <option>Cat friendly</option>
              <option>By approval</option>
            </select>
          </label>
          <label>
            <span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Utilities</span>
            <select className="cy-select cy-select--field" value={form.utilities} disabled={!canEdit} onChange={setField('utilities')} style={{ marginTop: 4, width: '100%' }}>
              <option>Not included</option>
              <option>Included</option>
              <option>Included with cap</option>
            </select>
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>
                Public description
              </span>
              {canEdit ? (
                <button
                  type="button"
                  className="cy-btn-ghost"
                  disabled={descGenerating || saving || !property?.propertyDbId}
                  onClick={() => {
                    if (!property?.propertyDbId) {
                      setError('This listing is not linked to a property record.')
                      return
                    }
                    setDescGenerating(true)
                    setError('')
                    void (async () => {
                      try {
                        const res = await generateListingDescription({
                          propertyId: property.propertyDbId,
                          listingId: form.id || undefined,
                        })
                        if (!res.success) {
                          setError(res.error)
                          return
                        }
                        setForm((prev) => ({ ...prev, description: res.description }))
                      } finally {
                        setDescGenerating(false)
                      }
                    })()
                  }}
                  style={{ fontSize: 12, padding: '4px 10px' }}
                >
                  {descGenerating ? 'Generating…' : 'Generate description'}
                </button>
              ) : null}
            </span>
            <textarea
              value={form.description}
              disabled={!canEdit}
              onChange={setField('description')}
              rows={4}
              style={{ ...fieldStyle, marginTop: 4, resize: 'vertical' }}
            />
          </label>
          <label>
            <span style={{ fontSize: '11.5px', color: 'var(--dim)', fontWeight: 600 }}>Status</span>
            <select
              className="cy-select cy-select--field"
              value={form.status}
              disabled={!canEdit}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as DraftListingStatus }))}
              style={{ marginTop: 4, width: '100%' }}
            >
              <option value="draft">Draft lease</option>
              <option value="renewal_sent">Renewal sent</option>
              <option value="declined">Renewal Declined</option>
              <option value="published">Published to public site</option>
            </select>
          </label>
        </div>

        {error ? <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{error}</div> : null}

        {canEdit ? (
          <div className="cy-entity-page-actions">
            <button
              type="button"
              onClick={remove}
              disabled={saving}
              style={{
                border: '1px solid var(--border)',
                background: 'none',
                color: 'var(--red)',
                borderRadius: 9,
                padding: '9px 14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
            <button
              type="button"
              className="cy-btn-primary cy-accent-btn"
              onClick={activate}
              disabled={saving || !canActivate}
              style={{ opacity: saving || !canActivate ? 0.55 : 1 }}
            >
              {saving ? 'Working…' : 'Activate lease'}
            </button>
            <button
              type="button"
              className="cy-btn-primary cy-accent-btn"
              onClick={submit}
              disabled={saving}
              style={{ opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving…' : 'Save listing'}
            </button>
          </div>
        ) : null}
      </div>
    </EntityPageShell>
  )
}

function listingToForm(listing: CanaryDraft | undefined) {
  return {
    id: listing?.id ?? null,
    propId: listing?.propId || listing?.unitId || '',
    tenantId: '',
    termType: 'fixed_term' as LeaseTermType,
    rent: listing?.rent ?? '',
    rentalCredit: listing?.rentalCredit ?? '',
    rentalCreditExpiry: listing?.rentalCreditExpiry ?? '',
    start: listing?.start ?? '',
    end: listing?.end ?? '',
    beds: listing?.beds ?? '',
    baths: listing?.baths ?? '',
    parking: listing?.parking ?? '',
    pets: listing?.pets || 'No pets',
    utilities: listing?.utilities || 'Not included',
    description: listing?.description ?? '',
    status: (listing?.status ?? 'published') as DraftListingStatus,
  }
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--input)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '9px 10px',
}

const stepBtnStyle: React.CSSProperties = {
  flex: 'none',
  width: 40,
  border: '1px solid var(--border)',
  background: 'var(--elev)',
  color: 'var(--text)',
  borderRadius: 8,
  fontWeight: 700,
  fontSize: 18,
  cursor: 'pointer',
  lineHeight: 1,
}
