// src/components/people/AddContactForm.tsx
// Dialog form for creating a contact record (tenant/owner/vendor). No portal invite (D-05).
'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createContact } from '@/app/actions/contacts'
import { toast } from 'sonner'

interface AddContactFormProps {
  buttonLabel?: string
}

const CONTACT_ROLES = [
  { value: 'tenant', label: 'Tenant' },
  { value: 'owner', label: 'Owner' },
  { value: 'vendor', label: 'Vendor' },
] as const

export function AddContactForm({ buttonLabel = 'Add Contact' }: AddContactFormProps) {
  const [open, setOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleRole(value: string) {
    setSelectedRoles((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]
    )
  }

  function resetForm() {
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setSelectedRoles([])
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (selectedRoles.length === 0) {
      setError('Please select at least one role.')
      return
    }

    startTransition(async () => {
      const result = await createContact({
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || undefined,
        roles: selectedRoles,
      })

      if (result.success) {
        toast.success('Contact created')
        setOpen(false)
        resetForm()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm() }}>
      <DialogTrigger render={<span />} onClick={() => setOpen(true)}>
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          {buttonLabel}
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {/* First name */}
          <div>
            <label htmlFor="contact-first-name" className="mb-1 block text-sm font-medium text-stone-700">
              First name
            </label>
            <input
              id="contact-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              placeholder="Jane"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>

          {/* Last name */}
          <div>
            <label htmlFor="contact-last-name" className="mb-1 block text-sm font-medium text-stone-700">
              Last name
            </label>
            <input
              id="contact-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              placeholder="Smith"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="contact-email" className="mb-1 block text-sm font-medium text-stone-700">
              Email address
            </label>
            <input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="jane@example.com"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="contact-phone" className="mb-1 block text-sm font-medium text-stone-700">
              Phone <span className="text-stone-400">(optional)</span>
            </label>
            <input
              id="contact-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 416 555 0100"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>

          {/* Role checkboxes — no 'admin' option (T-02-06 security gate) */}
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-stone-700">
              Role(s) <span className="text-red-500">*</span>
            </legend>
            <div className="flex flex-wrap gap-4">
              {CONTACT_ROLES.map((r) => (
                <label key={r.value} className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(r.value)}
                    onChange={() => toggleRole(r.value)}
                    className="h-4 w-4 rounded border-stone-300 accent-amber-600"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="mt-2 flex min-h-11 w-full items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {isPending ? 'Saving...' : 'Add Contact'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
