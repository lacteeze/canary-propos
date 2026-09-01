'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createOnboardingContact } from '@/app/actions/property-onboarding'
import {
  defaultOwnerPortfolioName,
  isOwnerPerson,
  mergeSelectOptions,
} from '@/lib/canary/property-onboarding'
import SearchableSelect from './SearchableSelect'

export type PersonPickerPerson = {
  id: string
  name: string
  email?: string
  roles?: string[]
  role?: string
}

export type CreatedPerson = {
  id: string
  name: string
  portfolioId?: string
  portfolioName?: string
}

type PersonPickerProps = {
  role: 'owner' | 'tenant'
  value: string
  onChange: (id: string) => void
  people: PersonPickerPerson[]
  propertyId?: string
  onCreated?: (created: CreatedPerson) => void
  placeholder?: string
  'aria-label'?: string
}

function matchesRole(person: PersonPickerPerson, role: 'owner' | 'tenant'): boolean {
  if (!person.roles?.length && !person.role) return true
  if (role === 'owner') return isOwnerPerson(person)
  return person.roles?.includes('tenant') || person.role === 'Tenant'
}

export default function PersonPicker({
  role,
  value,
  onChange,
  people,
  propertyId,
  onCreated,
  placeholder,
  'aria-label': ariaLabel,
}: PersonPickerProps) {
  const router = useRouter()
  const noun = role === 'owner' ? 'owner' : 'tenant'
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState({ name: '', email: '', phone: '' })
  const [extra, setExtra] = useState<{ value: string; label: string; searchText?: string }[]>([])

  const options = useMemo(
    () =>
      mergeSelectOptions(
        [
          { value: '', label: placeholder ?? (role === 'owner' ? 'No owner yet' : 'Select tenant…') },
          ...people.filter((p) => matchesRole(p, role)).map((p) => ({
            value: p.id,
            label: p.name,
            searchText: `${p.name} ${p.email ?? ''}`,
          })),
        ],
        extra,
      ),
    [people, extra, placeholder, role],
  )

  const startCreate = (query: string) => {
    setError('')
    setDraft({ name: query.trim(), email: '', phone: '' })
    setAdding(true)
  }

  const save = async () => {
    if (busy) return
    if (!draft.name.trim()) {
      setError('Name is required.')
      return
    }
    if (!draft.email.trim()) {
      setError('Email is required.')
      return
    }
    setBusy(true)
    setError('')
    const res = await createOnboardingContact({
      role,
      name: draft.name.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim() || undefined,
      propertyId,
    })
    setBusy(false)
    if (!res.success || !res.id) {
      setError(res.success ? `Failed to add ${noun}.` : res.error)
      return
    }
    const name = draft.name.trim()
    setExtra((prev) =>
      mergeSelectOptions(prev, [{ value: res.id!, label: name, searchText: `${name} ${draft.email}` }]),
    )
    onChange(res.id)
    onCreated?.({
      id: res.id,
      name,
      portfolioId: res.portfolioId,
      portfolioName: res.portfolioId ? defaultOwnerPortfolioName(name) : undefined,
    })
    setAdding(false)
    setDraft({ name: '', email: '', phone: '' })
    router.refresh()
  }

  return (
    <div>
      <SearchableSelect
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder ?? (role === 'owner' ? 'No owner yet' : 'Select tenant…')}
        searchPlaceholder={`Search ${noun}s…`}
        aria-label={ariaLabel ?? (role === 'owner' ? 'Owner' : 'Tenant')}
        emptyMessage={`No ${noun} matches`}
        createLabel={noun}
        onCreate={startCreate}
      />
      {adding ? (
        <div className="cy-inline-add">
          <input
            placeholder="Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            autoComplete="name"
          />
          <input
            placeholder="Email"
            type="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            autoComplete="email"
          />
          <input
            placeholder="Phone"
            type="tel"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            autoComplete="tel"
          />
          {error ? <div className="cy-setup-error" role="alert">{error}</div> : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="cy-btn-primary" disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : `Save ${noun}`}
            </button>
            <button
              type="button"
              className="cy-btn"
              disabled={busy}
              onClick={() => {
                setAdding(false)
                setError('')
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
