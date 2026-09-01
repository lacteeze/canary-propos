'use client'

import React, { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CanaryDraft, CanaryLease, CanaryOnboarding, CanaryPerson, CanaryPortfolio, CanaryProperty } from '@/lib/canary/types'
import type { PropertyDetailsInput } from '@/app/actions/entity-updates'
import {
  canSwitchPathWithoutConfirm,
  defaultOwnerPortfolioName,
  mergeSelectOptions,
  missingMustHaves,
  MISSING_MUST_HAVE_LABEL,
  stepAfterListingDraftSave,
  stepsForPath,
  type OnboardingPath,
  type OnboardingStep,
} from '@/lib/canary/property-onboarding'
import {
  recomputeOnboardingCompletion,
  saveOnboardingDetails,
  saveOnboardingPath,
  saveOnboardingStep,
} from '@/app/actions/property-onboarding'
import { createPortfolio } from '@/app/actions/portfolios'
import { saveDraftListing } from '@/app/actions/canary'
import { createLease } from '@/app/actions/leases'
import { DEFAULT_LISTING_BRIEF_OPTIONS, emptyListingBrief } from '@/lib/listings/listing-brief'
import SearchableSelect from './SearchableSelect'
import PersonPicker from './PersonPicker'
import { PropertyPhotoUpload } from '@/components/properties/PropertyPhotoUpload'

const PROPERTY_TYPES: { value: PropertyDetailsInput['propertyType']; label: string }[] = [
  { value: 'house', label: 'House' },
  { value: 'duplex', label: 'Duplex' },
  { value: 'apartment_building', label: 'Apartment Building' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'other', label: 'Other' },
]

function toPropertyType(raw: string): PropertyDetailsInput['propertyType'] {
  const key = raw.trim().toLowerCase().replace(/\s+/g, '_')
  const found = PROPERTY_TYPES.find((t) => t.value === key)
  return found?.value ?? 'house'
}

function toStatus(raw: string): PropertyDetailsInput['status'] {
  if (raw === 'Leased' || raw === 'Maintenance' || raw === 'STR' || raw === 'Office') return raw
  return 'Vacant'
}

const STEP_LABEL: Record<OnboardingStep, string> = {
  path: 'Path',
  details: 'Details',
  photos: 'Photos',
  listing: 'Listing',
  lease: 'Lease',
}

type WizardProps = {
  property: CanaryProperty
  onboarding: CanaryOnboarding
  orgId: string
  owners: CanaryPerson[]
  tenants: CanaryPerson[]
  portfolios: CanaryPortfolio[]
  draft: CanaryDraft | null
  lease: CanaryLease | null
  onExit: () => void
}

export default function PropertySetupWizard({
  property,
  onboarding,
  orgId,
  owners,
  tenants,
  portfolios,
  draft,
  lease,
  onExit,
}: WizardProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [step, setStep] = useState<OnboardingStep>(onboarding.currentStep || 'path')
  const [path, setPath] = useState<OnboardingPath | null>(onboarding.path)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  React.useEffect(() => {
    setPath(onboarding.path)
  }, [onboarding.path])

  React.useEffect(() => {
    if (property.ownerId) setOwnerId(property.ownerId)
  }, [property.ownerId])

  React.useEffect(() => {
    if (property.portfolioId) setPortfolioId(property.portfolioId)
  }, [property.portfolioId])

  const [ownerId, setOwnerId] = useState(property.ownerId || '')
  const [portfolioId, setPortfolioId] = useState(property.portfolioId || '')
  const [propertyType, setPropertyType] = useState(toPropertyType(property.type))
  const [beds, setBeds] = useState(property.beds || '1')
  const [baths, setBaths] = useState(property.baths || '1')
  const [rent, setRent] = useState(property.rate != null ? String(property.rate) : '')
  const [pets, setPets] = useState(property.petFriendly || '')
  const [parking, setParking] = useState(property.parking || '')
  const [utilities, setUtilities] = useState(property.utilitiesIncluded || '')
  const [feeType, setFeeType] = useState<'percent' | 'flat'>(property.mgmtFeeType === 'flat' ? 'flat' : 'percent')
  const [feeValue, setFeeValue] = useState(property.mgmtFeeValue || '')
  const [addingPortfolio, setAddingPortfolio] = useState(false)
  const [newPortfolioName, setNewPortfolioName] = useState('')
  const [extraOwners, setExtraOwners] = useState<{ value: string; label: string; searchText?: string }[]>([])
  const [extraPortfolios, setExtraPortfolios] = useState<{ value: string; label: string }[]>([])

  const [listingTitle, setListingTitle] = useState(draft?.title || property.address.split(',')[0])
  const [listingRent, setListingRent] = useState(draft?.rent || rent)
  const [listingStart, setListingStart] = useState(draft?.start || '')
  const [listingDesc, setListingDesc] = useState(draft?.description || '')

  const [tenantId, setTenantId] = useState(lease?.tenantIds?.split(',')[0]?.trim() || '')
  const [leaseStart, setLeaseStart] = useState(lease?.start || '')
  const [leaseEnd, setLeaseEnd] = useState(lease?.end || '')
  const [leaseRent, setLeaseRent] = useState(lease?.rent?.replace(/[^0-9.]/g, '') || rent)
  const [leaseDeposit, setLeaseDeposit] = useState(lease?.deposit?.replace(/[^0-9.]/g, '') || '')

  const refresh = useCallback(() => {
    startTransition(() => router.refresh())
  }, [router])

  const done = useCallback(
    (completed?: boolean) => {
      if (completed) {
        onExit()
        refresh()
        return
      }
      refresh()
    },
    [onExit, refresh],
  )

  const steps = stepsForPath(path)
  const snapshotBits = {
    hasListing: Boolean(draft),
    hasLease: Boolean(lease),
  }

  const goStep = async (next: OnboardingStep) => {
    setError('')
    const res = await saveOnboardingStep(property.propertyDbId, next)
    if (!res.success) {
      setError(res.error)
      return
    }
    setStep(next)
  }

  const exit = async () => {
    await saveOnboardingStep(property.propertyDbId, step)
    onExit()
    refresh()
  }

  const choosePath = async (path: OnboardingPath) => {
    if (busy) return
    let confirmed = false
    if (!canSwitchPathWithoutConfirm(snapshotBits)) {
      confirmed = window.confirm(
        'This property already has a listing or lease. Switch path anyway? Existing records stay.',
      )
      if (!confirmed) return
    }
    setBusy(true)
    setError('')
    const res = await saveOnboardingPath(property.propertyDbId, path, confirmed)
    setBusy(false)
    if (!res.success) {
      setError(res.error)
      return
    }
    setStep('details')
    setPath(path)
    done(res.completed)
  }

  const saveDetails = async () => {
    if (busy) return
    const bedsN = parseInt(beds, 10)
    const bathsN = parseFloat(baths)
    if (Number.isNaN(bedsN) || bedsN < 0) return setError('Enter bedrooms.')
    if (Number.isNaN(bathsN) || bathsN < 0) return setError('Enter bathrooms.')
    const rentN = rent.trim() === '' ? null : parseFloat(rent.replace(/[$,]/g, ''))
    if (rentN != null && (Number.isNaN(rentN) || rentN < 0)) return setError('Invalid asking rent.')
    const feeN = feeValue.trim() === '' ? null : parseFloat(feeValue)
    if (feeN != null && (Number.isNaN(feeN) || feeN < 0)) return setError('Invalid management fee.')

    setBusy(true)
    setError('')
    const details: PropertyDetailsInput = {
      status: toStatus(property.status),
      bedrooms: bedsN,
      bathrooms: bathsN,
      askingRent: rentN,
      hasGarage: property.hasGarage,
      propertyType,
      city: property.city,
      province: property.area,
      portfolioId: portfolioId || property.portfolioId || null,
      ownerId: ownerId || property.ownerId || null,
      managementFeeType: feeType,
      managementFeeValue: feeN,
      hospitablePropertyId: property.hospitablePropertyId || null,
      hospitableWidgetPropertyId: property.hospitableWidgetPropertyId || null,
    }
    const res = await saveOnboardingDetails({
      propertyId: property.propertyDbId,
      unitId: property.unitId,
      details,
      brief: { ...emptyListingBrief(), pets, parking, utilities },
    })
    if (!res.success) {
      setBusy(false)
      setError(res.error)
      return
    }
    setStep('photos')
    done(res.completed)
    if (!res.completed) setBusy(false)
  }

  const addPortfolio = async () => {
    const name = newPortfolioName.trim() || defaultOwnerPortfolioName(
      extraOwners.find((o) => o.value === ownerId)?.label ||
        owners.find((p) => p.id === ownerId)?.name ||
        '',
    )
    setBusy(true)
    setError('')
    const res = await createPortfolio({ name, owner_id: ownerId || null })
    setBusy(false)
    if (!res.success || !res.id) {
      setError(res.success ? 'Failed to add portfolio.' : res.error)
      return
    }
    setExtraPortfolios((prev) => mergeSelectOptions(prev, [{ value: res.id!, label: name }]))
    setPortfolioId(res.id)
    setAddingPortfolio(false)
    setNewPortfolioName('')
    refresh()
  }

  const saveListing = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    const res = await saveDraftListing({
      id: draft?.id ?? null,
      unitId: property.unitId,
      rent: listingRent === '' ? null : listingRent,
      start: listingStart || null,
      description: listingDesc || listingTitle || null,
      pets: pets || null,
      utilities: utilities || null,
      status: 'draft',
    })
    if (!res.success) {
      setBusy(false)
      setError(res.error)
      return
    }
    await saveOnboardingStep(property.propertyDbId, 'listing')
    const doneRes = await recomputeOnboardingCompletion(property.propertyDbId)
    if (!doneRes.success) {
      setBusy(false)
      setError(doneRes.error)
      return
    }
    if (doneRes.completed) {
      done(true)
      return
    }

    const leftover = missingMustHaves({
      path,
      detailsCompletedAt: onboarding.detailsCompletedAt || new Date().toISOString(),
      ownerId: ownerId || property.ownerId || null,
      listingPhotoCount: property.listingPhotoPaths?.length ?? 0,
      hasListing: true,
      hasLease: Boolean(lease),
      hasTenant: Boolean(lease?.tenantIds),
    })
    const next = stepAfterListingDraftSave(leftover)
    const labels = leftover.map((item) => MISSING_MUST_HAVE_LABEL[item]).join(', ')
    setNotice(
      leftover.includes('owner')
        ? 'Listing draft saved. Add an owner to finish setup.'
        : `Listing draft saved. Still need: ${labels || 'a few details'}.`,
    )
    setError('')
    if (next !== 'done' && next !== 'listing') {
      await saveOnboardingStep(property.propertyDbId, next)
      setStep(next)
    }
    setBusy(false)
  }

  const saveLease = async () => {
    if (busy) return
    if (lease) {
      await saveOnboardingStep(property.propertyDbId, 'lease')
      const doneRes = await recomputeOnboardingCompletion(property.propertyDbId)
      done(doneRes.success ? doneRes.completed : false)
      return
    }
    if (!tenantId) return setError('Select or add a tenant.')
    const rentN = parseFloat(leaseRent.replace(/[$,]/g, ''))
    const depN = leaseDeposit.trim() === '' ? 0 : parseFloat(leaseDeposit.replace(/[$,]/g, ''))
    if (!leaseStart) return setError('Start date is required.')
    if (Number.isNaN(rentN) || rentN <= 0) return setError('Enter monthly rent.')
    if (Number.isNaN(depN) || depN < 0) return setError('Invalid deposit.')
    setBusy(true)
    setError('')
    const res = await createLease({
      unit_id: property.unitId,
      tenant_id: tenantId,
      start_date: leaseStart,
      end_date: leaseEnd || null,
      monthly_rent: rentN,
      deposit_amount: depN,
      rent_due_day: 1,
    })
    if (!res.success) {
      setBusy(false)
      setError(res.error)
      return
    }
    await saveOnboardingStep(property.propertyDbId, 'lease')
    const doneRes = await recomputeOnboardingCompletion(property.propertyDbId)
    if (!doneRes.success) {
      setBusy(false)
      setError(doneRes.error)
      return
    }
    done(doneRes.completed)
    if (!doneRes.completed) setBusy(false)
  }

  const portfolioOptions = useMemo(
    () =>
      mergeSelectOptions(
        [
          { value: '', label: 'No portfolio' },
          ...portfolios.map((pf) => ({ value: pf.id, label: pf.name })),
        ],
        extraPortfolios,
      ),
    [portfolios, extraPortfolios],
  )

  const field: React.CSSProperties = {
    width: '100%',
    background: 'var(--input)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '9px 10px',
    marginTop: 4,
  }
  const label: React.CSSProperties = { fontSize: 11.5, color: 'var(--dim)', fontWeight: 600 }

  return (
    <section className="cy-setup" aria-label="Property setup">
      <header className="cy-setup-head">
        <div>
          <div className="cy-setup-kicker">Property setup</div>
          <h1 className="cy-setup-title">{property.address.split(',')[0]}</h1>
        </div>
        <button type="button" className="cy-btn" onClick={() => void exit()}>
          Save &amp; exit
        </button>
      </header>

      <div className="cy-setup-body">
        <nav className="cy-setup-rail" aria-label="Setup steps">
          {steps.map((s) => (
            <button
              key={s}
              type="button"
              className={`cy-setup-rail-btn${s === step ? ' is-current' : ''}`}
              onClick={() => void goStep(s)}
            >
              {STEP_LABEL[s]}
            </button>
          ))}
        </nav>

        <div className="cy-setup-pane">
          {error ? <div className="cy-setup-error">{error}</div> : null}
          {notice ? <div className="cy-setup-notice" role="status">{notice}</div> : null}

          {step === 'path' && (
            <div className="cy-setup-path">
              <p className="cy-setup-lead">Is this unit vacant and going on the market, or already occupied?</p>
              <button type="button" className="cy-setup-choice" disabled={busy} onClick={() => void choosePath('vacant')}>
                <strong>Vacant</strong>
                <span>Photos, details, then a listing draft. Publish when you are ready.</span>
              </button>
              <button type="button" className="cy-setup-choice" disabled={busy} onClick={() => void choosePath('occupied')}>
                <strong>Occupied</strong>
                <span>Photos, details, then the current lease and tenant.</span>
              </button>
            </div>
          )}

          {step === 'details' && (
            <div className="cy-setup-form">
              <div>
                <span style={label}>Owner</span>
                <PersonPicker
                  role="owner"
                  value={ownerId}
                  onChange={setOwnerId}
                  people={owners}
                  propertyId={property.propertyDbId}
                  placeholder="No owner yet"
                  aria-label="Owner"
                  onCreated={(created) => {
                    setExtraOwners((prev) =>
                      mergeSelectOptions(prev, [{ value: created.id, label: created.name }]),
                    )
                    if (created.portfolioId) {
                      setExtraPortfolios((prev) =>
                        mergeSelectOptions(prev, [
                          { value: created.portfolioId!, label: created.portfolioName || defaultOwnerPortfolioName(created.name) },
                        ]),
                      )
                      setPortfolioId(created.portfolioId)
                    }
                  }}
                />
              </div>
              <div>
                <span style={label}>Portfolio</span>
                <SearchableSelect
                  value={portfolioId}
                  onChange={setPortfolioId}
                  options={portfolioOptions}
                  placeholder="No portfolio"
                  searchPlaceholder="Search portfolios…"
                  aria-label="Portfolio"
                />
              </div>
              {!addingPortfolio ? (
                <button
                  type="button"
                  className="cy-setup-link"
                  onClick={() => {
                    const ownerName =
                      extraOwners.find((o) => o.value === ownerId)?.label ||
                      owners.find((p) => p.id === ownerId)?.name ||
                      ''
                    setNewPortfolioName(ownerName ? defaultOwnerPortfolioName(ownerName) : '')
                    setAddingPortfolio(true)
                  }}
                >
                  Add portfolio
                </button>
              ) : (
                <div className="cy-setup-inline">
                  <input
                    placeholder="Portfolio name"
                    value={newPortfolioName}
                    onChange={(e) => setNewPortfolioName(e.target.value)}
                    style={field}
                  />
                  <button type="button" className="cy-btn-primary" disabled={busy} onClick={() => void addPortfolio()}>
                    Save portfolio
                  </button>
                </div>
              )}
              <label style={label}>
                Type
                <select
                  className="cy-select cy-select--field"
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value as PropertyDetailsInput['propertyType'])}
                  style={{ ...field, width: '100%' }}
                >
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
              <div className="cy-setup-row">
                <label style={label}>
                  Beds
                  <input type="number" min={0} value={beds} onChange={(e) => setBeds(e.target.value)} style={field} />
                </label>
                <label style={label}>
                  Baths
                  <input type="number" min={0} step={0.5} value={baths} onChange={(e) => setBaths(e.target.value)} style={field} />
                </label>
              </div>
              <label style={label}>
                Asking rent
                <input value={rent} onChange={(e) => setRent(e.target.value)} style={field} />
              </label>
              <label style={label}>
                Pets
                <select className="cy-select cy-select--field" value={pets} onChange={(e) => setPets(e.target.value)} style={{ ...field, width: '100%' }}>
                  <option value="">— Select —</option>
                  {(pets && !DEFAULT_LISTING_BRIEF_OPTIONS.pets.includes(pets) ? [pets, ...DEFAULT_LISTING_BRIEF_OPTIONS.pets] : DEFAULT_LISTING_BRIEF_OPTIONS.pets).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label style={label}>
                Parking
                <select className="cy-select cy-select--field" value={parking} onChange={(e) => setParking(e.target.value)} style={{ ...field, width: '100%' }}>
                  <option value="">— Select —</option>
                  {(parking && !DEFAULT_LISTING_BRIEF_OPTIONS.parking.includes(parking) ? [parking, ...DEFAULT_LISTING_BRIEF_OPTIONS.parking] : DEFAULT_LISTING_BRIEF_OPTIONS.parking).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label style={label}>
                Utilities
                <select className="cy-select cy-select--field" value={utilities} onChange={(e) => setUtilities(e.target.value)} style={{ ...field, width: '100%' }}>
                  <option value="">— Select —</option>
                  {(utilities && !DEFAULT_LISTING_BRIEF_OPTIONS.utilities.includes(utilities) ? [utilities, ...DEFAULT_LISTING_BRIEF_OPTIONS.utilities] : DEFAULT_LISTING_BRIEF_OPTIONS.utilities).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
              <div className="cy-setup-row">
                <label style={label}>
                  Fee type
                  <select className="cy-select cy-select--field" value={feeType} onChange={(e) => setFeeType(e.target.value === 'flat' ? 'flat' : 'percent')} style={{ ...field, width: '100%' }}>
                    <option value="percent">Percent</option>
                    <option value="flat">Flat</option>
                  </select>
                </label>
                <label style={label}>
                  Fee value
                  <input value={feeValue} onChange={(e) => setFeeValue(e.target.value)} style={field} />
                </label>
              </div>
              <button type="button" className="cy-btn-primary" disabled={busy} onClick={() => void saveDetails()}>
                {busy ? 'Saving…' : 'Continue'}
              </button>
            </div>
          )}

          {step === 'photos' && (
            <div>
              <p className="cy-setup-lead">Add at least one listing photo. You can keep going and come back.</p>
              <PropertyPhotoUpload
                propertyId={property.propertyDbId}
                orgId={orgId}
                visibility="listing"
                compact
                onChanged={() => {
                  void recomputeOnboardingCompletion(property.propertyDbId).then((res) => {
                    if (res.success && res.completed) done(true)
                    else refresh()
                  })
                }}
              />
              <div className="cy-setup-actions">
                <button
                  type="button"
                  className="cy-btn-primary"
                  disabled={busy}
                  onClick={() => void goStep(path === 'occupied' ? 'lease' : 'listing')}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 'listing' && (
            <div className="cy-setup-form" aria-busy={busy}>
              <p className="cy-setup-lead">Saved as a draft. Publish later from the listing if you want it on the public site.</p>
              <label style={label}>
                Title
                <input value={listingTitle} onChange={(e) => setListingTitle(e.target.value)} style={field} disabled={busy} />
              </label>
              <label style={label}>
                Rent
                <input value={listingRent} onChange={(e) => setListingRent(e.target.value)} style={field} disabled={busy} />
              </label>
              <label style={label}>
                Available from
                <input type="date" value={listingStart} onChange={(e) => setListingStart(e.target.value)} style={field} disabled={busy} />
              </label>
              <label style={label}>
                Description
                <textarea value={listingDesc} onChange={(e) => setListingDesc(e.target.value)} style={{ ...field, minHeight: 96 }} disabled={busy} />
              </label>
              <button
                type="button"
                className="cy-btn-primary"
                disabled={busy}
                aria-live="polite"
                onClick={() => void saveListing()}
              >
                {busy ? 'Saving draft…' : 'Save listing draft'}
              </button>
            </div>
          )}

          {step === 'lease' && (
            <div className="cy-setup-form">
              {lease ? (
                <p className="cy-setup-lead">A lease is already on this unit. Continue to finish setup once owner and photos are in.</p>
              ) : (
                <>
                  <label>
                    <span style={label}>Tenant</span>
                    <PersonPicker
                      role="tenant"
                      value={tenantId}
                      onChange={setTenantId}
                      people={tenants}
                      placeholder="Select tenant…"
                      aria-label="Tenant"
                    />
                  </label>
                  <div className="cy-setup-row">
                    <label style={label}>
                      Start
                      <input type="date" value={leaseStart} onChange={(e) => setLeaseStart(e.target.value)} style={field} />
                    </label>
                    <label style={label}>
                      End
                      <input type="date" value={leaseEnd} onChange={(e) => setLeaseEnd(e.target.value)} style={field} />
                    </label>
                  </div>
                  <div className="cy-setup-row">
                    <label style={label}>
                      Rent
                      <input value={leaseRent} onChange={(e) => setLeaseRent(e.target.value)} style={field} />
                    </label>
                    <label style={label}>
                      Deposit
                      <input value={leaseDeposit} onChange={(e) => setLeaseDeposit(e.target.value)} style={field} />
                    </label>
                  </div>
                </>
              )}
              <button type="button" className="cy-btn-primary" disabled={busy} onClick={() => void saveLease()}>
                {busy ? 'Saving…' : lease ? 'Finish' : 'Save lease'}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
