'use client'

import { useState, useTransition } from 'react'
import { generateLeaseDownloadUrl } from '@/app/actions/leases'

interface LeaseDownloadButtonProps {
  leaseId: string
  hasDocument: boolean
}

export default function LeaseDownloadButton({ leaseId, hasDocument }: LeaseDownloadButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const url = await generateLeaseDownloadUrl(leaseId)
      if (url) {
        window.open(url, '_blank')
      } else {
        setError('Could not generate download link. Please try again or contact your property manager.')
      }
    })
  }

  if (!hasDocument) {
    return (
      <button
        disabled
        title="No document on file — contact your property manager."
        className="w-full cursor-not-allowed rounded-lg border border-stone-200 bg-stone-100 px-4 py-2.5 text-sm font-medium text-stone-400 sm:w-auto"
      >
        Download Lease PDF
      </button>
    )
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isPending}
        className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {isPending ? 'Downloading…' : 'Download Lease PDF'}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
