// src/components/listings/ListingForm.tsx
// Dialog form for creating or editing a unit listing
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createListing, updateListing } from '@/app/actions/listings'
import { toast } from 'sonner'

interface Unit {
  id: string
  unit_number: string | null
  bedrooms: number
  bathrooms: number
}

interface ExistingListing {
  id: string
  unit_id: string
  listing_title: string
  listing_description: string | null
  highlights: string[] | null
  display_rent: number | null
  available_from: string | null
  listing_status: string
}

interface ListingFormProps {
  propertyId: string
  orgId: string
  units: Unit[]
  existingListing?: ExistingListing
  buttonLabel?: string
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'renewal_sent', label: 'Renewal sent' },
  { value: 'published', label: 'Published' },
  { value: 'unlisted', label: 'Unlisted' },
]

export function ListingForm({
  propertyId,
  orgId: _orgId,
  units,
  existingListing,
  buttonLabel,
}: ListingFormProps) {
  const router = useRouter()
  const isEditMode = !!existingListing

  const [open, setOpen] = useState(false)
  const [unitId, setUnitId] = useState(existingListing?.unit_id ?? (units[0]?.id ?? ''))
  const [title, setTitle] = useState(existingListing?.listing_title ?? '')
  const [description, setDescription] = useState(existingListing?.listing_description ?? '')
  const [highlightsRaw, setHighlightsRaw] = useState(
    existingListing?.highlights?.join(', ') ?? ''
  )
  const [displayRent, setDisplayRent] = useState(
    existingListing?.display_rent != null ? String(existingListing.display_rent) : ''
  )
  const [availableFrom, setAvailableFrom] = useState(existingListing?.available_from ?? '')
  const [status, setStatus] = useState(existingListing?.listing_status ?? 'draft')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const defaultLabel = isEditMode ? 'Edit listing' : 'Create listing'

  function parseHighlights(raw: string): string[] {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const highlights = parseHighlights(highlightsRaw)
    const payload = {
      unit_id: unitId,
      listing_title: title,
      listing_description: description || null,
      highlights,
      display_rent: displayRent ? parseFloat(displayRent) : null,
      available_from: availableFrom || null,
      status,
      property_id: propertyId,
    }

    startTransition(async () => {
      const result = isEditMode
        ? await updateListing(existingListing!.id, payload)
        : await createListing(payload)

      if (result.success) {
        toast.success(isEditMode ? 'Listing updated' : 'Listing created')
        setOpen(false)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<span />} onClick={() => setOpen(true)}>
        <button
          type="button"
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
        >
          {buttonLabel ?? defaultLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Listing' : 'Create Listing'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Unit selector */}
          <div>
            <label className="block text-sm font-medium text-stone-700">
              Unit <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {units.length === 0 && (
                <option value="" disabled>No units available</option>
              )}
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  Unit {unit.unit_number ?? '—'} · {unit.bedrooms} bd / {unit.bathrooms} ba
                </option>
              ))}
            </select>
          </div>

          {/* Listing title */}
          <div>
            <label className="block text-sm font-medium text-stone-700">
              Listing Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Bright 2-Bedroom Downtown Apartment"
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-stone-700">Description</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the unit, neighbourhood, features…"
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Highlights */}
          <div>
            <label className="block text-sm font-medium text-stone-700">Highlights</label>
            <input
              type="text"
              value={highlightsRaw}
              onChange={(e) => setHighlightsRaw(e.target.value)}
              placeholder="e.g. In-unit laundry, Parking included, Pet friendly"
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <p className="mt-1 text-xs text-stone-400">Separate items with commas</p>
          </div>

          {/* Display rent + Available from */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700">Display Rent ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={displayRent}
                onChange={(e) => setDisplayRent(e.target.value)}
                placeholder="e.g. 1650"
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <p className="mt-1 text-xs text-stone-400">Overrides unit asking rent on the listing</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">Available From</label>
              <input
                type="date"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-stone-700">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {isPending ? (isEditMode ? 'Saving…' : 'Creating…') : (isEditMode ? 'Save changes' : 'Create listing')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
