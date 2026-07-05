// src/components/properties/AddUnitForm.tsx
// Dialog form for adding a unit to a property
'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createUnit } from '@/app/actions/units'
import { toast } from 'sonner'

const AMENITY_OPTIONS = [
  { value: 'Parking', label: 'Parking' },
  { value: 'Laundry', label: 'Laundry' },
  { value: 'Dishwasher', label: 'Dishwasher' },
  { value: 'AC', label: 'AC' },
  { value: 'Balcony', label: 'Balcony' },
  { value: 'Storage', label: 'Storage' },
]

const STATUS_OPTIONS = [
  { value: 'vacant', label: 'Vacant' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'maintenance', label: 'Maintenance' },
]

interface AddUnitFormProps {
  propertyId: string
  buttonLabel?: string
}

export function AddUnitForm({ propertyId, buttonLabel = 'Add Unit' }: AddUnitFormProps) {
  const [open, setOpen] = useState(false)
  const [unitNumber, setUnitNumber] = useState('')
  const [floor, setFloor] = useState('')
  const [bedrooms, setBedrooms] = useState('1')
  const [bathrooms, setBathrooms] = useState('1')
  const [sqFootage, setSqFootage] = useState('')
  const [askingRent, setAskingRent] = useState('')
  const [status, setStatus] = useState('vacant')
  const [amenities, setAmenities] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleAmenity(value: string) {
    setAmenities((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createUnit({
        property_id: propertyId,
        unit_number: unitNumber,
        floor: floor ? parseInt(floor, 10) : null,
        bedrooms: parseInt(bedrooms, 10),
        bathrooms: parseFloat(bathrooms),
        sq_footage: sqFootage ? parseFloat(sqFootage) : null,
        asking_rent: askingRent ? parseFloat(askingRent) : null,
        status,
        amenities: amenities.length > 0 ? amenities : null,
      })
      if (result.success) {
        toast.success('Unit added')
        setOpen(false)
        // Reset form
        setUnitNumber('')
        setFloor('')
        setBedrooms('1')
        setBathrooms('1')
        setSqFootage('')
        setAskingRent('')
        setStatus('vacant')
        setAmenities([])
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
          {buttonLabel}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Unit</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Unit Number */}
          <div>
            <label className="block text-sm font-medium text-stone-700">
              Unit Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              placeholder="e.g. 101, A, Main"
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Floor */}
          <div>
            <label className="block text-sm font-medium text-stone-700">Floor</label>
            <input
              type="number"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              placeholder="e.g. 1"
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Beds + Baths */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700">
                Bedrooms <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min={0}
                step={1}
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">
                Bathrooms <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min={0.5}
                step={0.5}
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Sq Footage + Asking Rent */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700">Sq. Footage</label>
              <input
                type="number"
                min={0}
                value={sqFootage}
                onChange={(e) => setSqFootage(e.target.value)}
                placeholder="e.g. 750"
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">Asking Rent ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={askingRent}
                onChange={(e) => setAskingRent(e.target.value)}
                placeholder="e.g. 1500"
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

          {/* Amenities */}
          <div>
            <label className="block text-sm font-medium text-stone-700">Amenities</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map((amenity) => (
                <label
                  key={amenity.value}
                  className="flex cursor-pointer items-center gap-1.5 rounded-md border border-stone-200 px-3 py-1.5 text-sm hover:bg-stone-50"
                >
                  <input
                    type="checkbox"
                    checked={amenities.includes(amenity.value)}
                    onChange={() => toggleAmenity(amenity.value)}
                    className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                  />
                  {amenity.label}
                </label>
              ))}
            </div>
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
              {isPending ? 'Adding…' : 'Add Unit'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
