// src/components/people/EditContactForm.tsx
// Pre-filled dialog for editing a contact. Also provides deactivate action.
'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { updateContact, deactivateContact } from '@/app/actions/contacts'
import { toast } from 'sonner'

interface Contact {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  role: string[]
  active: boolean
}

interface EditContactFormProps {
  contact: Contact
}

const CONTACT_ROLES = [
  { value: 'tenant', label: 'Tenant' },
  { value: 'owner', label: 'Owner' },
  { value: 'vendor', label: 'Vendor' },
] as const

export function EditContactForm({ contact }: EditContactFormProps) {
  const [open, setOpen] = useState(false)
  const [firstName, setFirstName] = useState(contact.first_name ?? '')
  const [lastName, setLastName] = useState(contact.last_name ?? '')
  const [email, setEmail] = useState(contact.email)
  const [phone, setPhone] = useState(contact.phone ?? '')
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    contact.role.filter((r) => ['tenant', 'owner', 'vendor'].includes(r))
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isDeactivating, startDeactivateTransition] = useTransition()

  function toggleRole(value: string) {
    setSelectedRoles((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (selectedRoles.length === 0) {
      setError('Please select at least one role.')
      return
    }

    startTransition(async () => {
      const result = await updateContact(contact.id, {
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || undefined,
        roles: selectedRoles,
      })

      if (result.success) {
        toast.success('Changes saved')
        setOpen(false)
      } else {
        setError(result.error)
      }
    })
  }

  function handleDeactivate() {
    if (!window.confirm(`Deactivate ${contact.first_name ?? contact.email}? They will be removed from your contacts list.`)) {
      return
    }

    startDeactivateTransition(async () => {
      const result = await deactivateContact(contact.id)
      if (result.success) {
        toast.success('Contact deactivated')
        setOpen(false)
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
          className="text-sm text-stone-600 hover:text-stone-900"
        >
          Edit
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {/* First name */}
          <div>
            <label htmlFor={`edit-first-${contact.id}`} className="mb-1 block text-sm font-medium text-stone-700">
              First name
            </label>
            <input
              id={`edit-first-${contact.id}`}
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>

          {/* Last name */}
          <div>
            <label htmlFor={`edit-last-${contact.id}`} className="mb-1 block text-sm font-medium text-stone-700">
              Last name
            </label>
            <input
              id={`edit-last-${contact.id}`}
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor={`edit-email-${contact.id}`} className="mb-1 block text-sm font-medium text-stone-700">
              Email address
            </label>
            <input
              id={`edit-email-${contact.id}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>

          {/* Phone */}
          <div>
            <label htmlFor={`edit-phone-${contact.id}`} className="mb-1 block text-sm font-medium text-stone-700">
              Phone <span className="text-stone-400">(optional)</span>
            </label>
            <input
              id={`edit-phone-${contact.id}`}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>

          {/* Role checkboxes — no 'admin' option */}
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
            disabled={isPending || isDeactivating}
            className="mt-2 flex min-h-11 w-full items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {isPending ? 'Saving...' : 'Save Changes'}
          </button>

          {/* Deactivate action */}
          <div className="border-t border-stone-100 pt-3">
            <button
              type="button"
              disabled={isPending || isDeactivating}
              onClick={handleDeactivate}
              className="text-sm text-red-600 hover:text-red-700 disabled:opacity-60"
            >
              {isDeactivating ? 'Deactivating...' : 'Deactivate contact'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
