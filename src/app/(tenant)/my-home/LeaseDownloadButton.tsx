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
        setError(
          'Could not generate download link. Please try again or contact your property manager.',
        )
      }
    })
  }

  if (!hasDocument) {
    return (
      <button type="button" disabled className="cy-btn" title="No document on file — contact your property manager.">
        Download lease PDF
      </button>
    )
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={isPending} className="cy-btn">
        {isPending ? 'Downloading…' : 'Download lease PDF'}
      </button>
      {error && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--red)' }}>{error}</p>
      )}
    </div>
  )
}
