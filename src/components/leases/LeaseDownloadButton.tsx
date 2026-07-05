'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { generateLeaseDownloadUrl } from '@/app/actions/leases'
import { Button } from '@/components/ui/button'

interface LeaseDownloadButtonProps {
  leaseId: string
}

export function LeaseDownloadButton({ leaseId }: LeaseDownloadButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    const url = await generateLeaseDownloadUrl(leaseId)
    setLoading(false)

    if (!url) {
      toast.error('Could not generate download link. Please try again.')
      return
    }

    window.open(url, '_blank')
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={loading}
    >
      {loading ? 'Generating link…' : 'Download PDF'}
    </Button>
  )
}
