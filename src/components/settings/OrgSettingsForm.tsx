// src/components/settings/OrgSettingsForm.tsx
// Org settings form — name, logo (stub), province (UI-SPEC §5)
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CANADIAN_PROVINCES } from '@/lib/constants/provinces'
import { updateOrgProfile } from '@/app/(manager)/settings/actions'

interface OrgSettingsFormProps {
  orgId: string
  initialName: string
  initialProvince: string
  initialLogoPath: string | null
}

export function OrgSettingsForm({
  initialName,
  initialProvince,
}: OrgSettingsFormProps) {
  const [name, setName] = useState(initialName)
  const [province, setProvince] = useState(initialProvince)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updateOrgProfile({ name, province })
      if (result.success) {
        toast.success('Changes saved')
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Section: Organization name */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-stone-900">Organization name</h2>
        <div className="mb-4">
          <label htmlFor="settings-name" className="mb-1 block text-sm font-medium text-stone-700">
            Name
          </label>
          <input
            id="settings-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
            placeholder="e.g. Canary Property Management"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {isPending ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </section>

      {/* Section: Logo (stub — upload wired in future plan) */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-stone-900">Logo</h2>
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-stone-300 bg-stone-50 text-stone-400">
            <span className="text-xs text-center leading-tight px-1">Upload logo</span>
          </div>
          <p className="text-sm text-stone-500">
            Logo upload will be available soon. Your logo appears on tenant portals and email communications.
          </p>
        </div>
      </section>

      {/* Section: Province */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-stone-900">Province or Territory</h2>
        <div className="mb-4">
          <label htmlFor="settings-province" className="mb-1 block text-sm font-medium text-stone-700">
            Where do you operate?
          </label>
          <select
            id="settings-province"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            required
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
          >
            <option value="" disabled>Select province or territory</option>
            {CANADIAN_PROVINCES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {isPending ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </section>

      {/* Section: Branding color — Coming soon (UI-SPEC §5) */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-stone-900">Branding color</h2>
        <div className="mb-4">
          <label htmlFor="settings-brand-color" className="mb-1 block text-sm font-medium text-stone-400">
            Brand color <span className="ml-1 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-400">Coming soon</span>
          </label>
          <input
            id="settings-brand-color"
            type="text"
            disabled
            placeholder="#D97706"
            className="w-full cursor-not-allowed rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-400"
          />
        </div>
      </section>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
