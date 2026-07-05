// src/components/people/InviteUserForm.tsx
// Invite user dialog + form — manager-only (ORGS-01)
'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { inviteUser } from '@/app/(manager)/people/actions'
import { toast } from 'sonner'

interface InviteUserFormProps {
  orgName: string
  buttonLabel?: string
}

const ROLES = [
  { value: 'manager', label: 'Manager' },
  { value: 'employee', label: 'Employee' },
  { value: 'tenant', label: 'Tenant' },
]

export function InviteUserForm({ orgName, buttonLabel = 'Invite someone' }: InviteUserFormProps) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('manager')
  const [firstName, setFirstName] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [unitNumber, setUnitNumber] = useState('')
  const [moveInDate, setMoveInDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await inviteUser({
        email,
        role,
        firstName: firstName || undefined,
        propertyAddress: role === 'tenant' ? propertyAddress : undefined,
        unitNumber: role === 'tenant' ? unitNumber : undefined,
        moveInDate: role === 'tenant' ? moveInDate : undefined,
      })

      if (result.success) {
        toast.success(`Invite sent to ${email}`)
        setOpen(false)
        // Reset form
        setEmail('')
        setRole('manager')
        setFirstName('')
        setPropertyAddress('')
        setUnitNumber('')
        setMoveInDate('')
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
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          {buttonLabel}
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite someone to {orgName}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="invite-email" className="mb-1 block text-sm font-medium text-stone-700">
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="colleague@example.com"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>

          {/* Role */}
          <div>
            <label htmlFor="invite-role" className="mb-1 block text-sm font-medium text-stone-700">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* First name (optional) */}
          <div>
            <label htmlFor="invite-first-name" className="mb-1 block text-sm font-medium text-stone-700">
              First name <span className="text-stone-400">(optional)</span>
            </label>
            <input
              id="invite-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Their first name"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>

          {/* Tenant-only fields (D-07) */}
          {role === 'tenant' && (
            <>
              <div>
                <label htmlFor="invite-address" className="mb-1 block text-sm font-medium text-stone-700">
                  Property address
                </label>
                <input
                  id="invite-address"
                  type="text"
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  placeholder="123 Main St, Toronto, ON"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
              <div>
                <label htmlFor="invite-unit" className="mb-1 block text-sm font-medium text-stone-700">
                  Unit number
                </label>
                <input
                  id="invite-unit"
                  type="text"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  placeholder="e.g. 4A"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
              <div>
                <label htmlFor="invite-movein" className="mb-1 block text-sm font-medium text-stone-700">
                  Move-in date
                </label>
                <input
                  id="invite-movein"
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
            </>
          )}

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
            {isPending ? 'Sending...' : 'Send invite'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
