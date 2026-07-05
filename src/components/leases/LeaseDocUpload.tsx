'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { updateLeaseDocumentPath } from '@/app/actions/leases'
import { Button } from '@/components/ui/button'

interface LeaseDocUploadProps {
  leaseId: string
  orgId: string
  existingDocumentPath: string | null
  onUploadComplete?: (path: string) => void
}

export function LeaseDocUpload({
  leaseId,
  orgId,
  existingDocumentPath,
  onUploadComplete,
}: LeaseDocUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [filename, setFilename] = useState<string | null>(
    existingDocumentPath ? existingDocumentPath.split('/').pop() ?? null : null
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are accepted.')
      return
    }

    setUploading(true)

    const storagePath = `${orgId}/leases/${leaseId}/${Date.now()}-${file.name}`
    const supabase = createClient()

    const { error: uploadError } = await supabase.storage
      .from('org-assets')
      .upload(storagePath, file, { upsert: true })

    if (uploadError) {
      console.error('[LeaseDocUpload] upload error:', uploadError)
      toast.error('Upload failed. Please try again.')
      setUploading(false)
      return
    }

    const result = await updateLeaseDocumentPath(leaseId, storagePath)

    if (!result.success) {
      toast.error(result.error)
      setUploading(false)
      return
    }

    setFilename(file.name)
    onUploadComplete?.(storagePath)
    toast.success('Lease document uploaded.')
    setUploading(false)

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-3">
      {filename && (
        <p className="text-sm text-stone-600">
          Current file: <span className="font-medium">{filename}</span>
        </p>
      )}
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          id={`lease-doc-upload-${leaseId}`}
          onChange={handleFileChange}
          disabled={uploading}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Uploading…' : filename ? 'Replace PDF' : 'Upload PDF'}
        </Button>
        {uploading && (
          <span className="text-sm text-stone-500">Uploading lease document…</span>
        )}
      </div>
      <p className="text-xs text-stone-400">PDF files only. Max 50 MB.</p>
    </div>
  )
}
