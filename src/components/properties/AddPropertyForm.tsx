// src/components/properties/AddPropertyForm.tsx
// Dialog form for creating a property (UI-SPEC §2 Add Property)
'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createProperty } from '@/app/actions/properties'
import { CANADIAN_PROVINCES } from '@/lib/constants/provinces'
import { toast } from 'sonner'

const PROPERTY_TYPES = [
  { value: 'house', label: 'House' },
  { value: 'duplex', label: 'Duplex' },
  { value: 'apartment_building', label: 'Apartment Building' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'other', label: 'Other' },
]

interface Owner {
  id: string
  first_name: string | null
  last_name: string | null
}

interface Portfolio {
  id: string
  name: string
}

interface AddPropertyFormProps {
  orgProvince: string
  owners: Owner[]
  portfolios: Portfolio[]
  buttonLabel?: string
}

export function AddPropertyForm({
  orgProvince,
  owners,
  portfolios,
  buttonLabel = 'Add Property',
}: AddPropertyFormProps) {
  const [open, setOpen] = useState(false)
  const [streetAddress, setStreetAddress] = useState('')
  const [city, setCity] = useState('')
  const [province, setProvince] = useState(orgProvince)
  const [postalCode, setPostalCode] = useState('')
  const [propertyType, setPropertyType] = useState('house')
  const [ownerId, setOwnerId] = useState('')
  const [portfolioId, setPortfolioId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createProperty({
        street_address: streetAddress,
        city,
        province,
        postal_code: postalCode || undefined,
        property_type: propertyType,
        owner_id: ownerId || null,
        portfolio_id: portfolioId || null,
      })
      if (result.success) {
        toast.success('Property created')
        setOpen(false)
        // Reset form
        setStreetAddress('')
        setCity('')
        setProvince(orgProvince)
        setPostalCode('')
        setPropertyType('house')
        setOwnerId('')
        setPortfolioId('')
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
          <DialogTitle>Add Property</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Street Address */}
          <div>
            <label className="block text-sm font-medium text-stone-700">
              Street Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={streetAddress}
              onChange={(e) => setStreetAddress(e.target.value)}
              placeholder="123 Main St"
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-stone-700">
              City <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Toronto"
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Province + Postal Code */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700">
                Province <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {CANADIAN_PROVINCES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">Postal Code</label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="A1B 2C3"
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Property Type */}
          <div>
            <label className="block text-sm font-medium text-stone-700">
              Property Type <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Owner */}
          {owners.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-stone-700">Owner</label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">— No owner assigned —</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {[o.first_name, o.last_name].filter(Boolean).join(' ') || o.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Portfolio */}
          {portfolios.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-stone-700">Portfolio</label>
              <select
                value={portfolioId}
                onChange={(e) => setPortfolioId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">— No portfolio —</option>
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              {isPending ? 'Creating…' : 'Create Property'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
