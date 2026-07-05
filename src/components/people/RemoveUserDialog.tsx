// src/components/people/RemoveUserDialog.tsx
// Confirm dialog before removing a user from the org (UI-SPEC Destructive Actions)
'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { removeUserFromOrg } from '@/app/(manager)/people/actions'

interface RemoveUserDialogProps {
  personId: string
  personName: string
  orgName: string
  trigger: React.ReactNode
  onRemoved?: () => void
}

export function RemoveUserDialog({
  personId,
  personName,
  orgName,
  trigger,
  onRemoved,
}: RemoveUserDialogProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await removeUserFromOrg(personId)
      if (result.success) {
        setOpen(false)
        onRemoved?.()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<span />} onClick={() => setOpen(true)}>
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Remove {personName} from {orgName}?
          </DialogTitle>
          <DialogDescription>
            They&apos;ll lose access immediately and their active sessions will be ended.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
          >
            Keep access
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {isPending ? 'Removing...' : 'Yes, remove'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
