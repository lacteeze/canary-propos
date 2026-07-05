// src/components/properties/PropertyPhotoUpload.tsx
// Client component for uploading property photos to Supabase Storage (org-assets bucket)
'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { updatePropertyPhotos } from '@/app/actions/properties'

interface PropertyPhotoUploadProps {
  propertyId: string
  orgId: string
  existingPaths: string[]
}

export function PropertyPhotoUpload({ propertyId, orgId, existingPaths }: PropertyPhotoUploadProps) {
  const [signedUrls, setSignedUrls] = useState<Array<{ path: string; url: string }>>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (existingPaths.length === 0) return
    async function loadSignedUrls() {
      const results = await Promise.all(
        existingPaths.map(async (path) => {
          const { data } = await supabase.storage
            .from('org-assets')
            .createSignedUrl(path, 3600)
          return { path, url: data?.signedUrl ?? '' }
        })
      )
      setSignedUrls(results.filter((r) => r.url))
    }
    loadSignedUrls()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingPaths.join(',')])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const path = `${orgId}/properties/${propertyId}/photos/${Date.now()}-${file.name}`

      const { error: uploadError } = await supabase.storage
        .from('org-assets')
        .upload(path, file, { upsert: false })

      if (uploadError) {
        setError('Upload failed: ' + uploadError.message)
        return
      }

      // Update the property photo_paths via server action
      const newPaths = [...existingPaths, path]
      const result = await updatePropertyPhotos(propertyId, newPaths)

      if (!result.success) {
        setError(result.error)
        return
      }

      // Create signed URL for the new photo
      const { data: signedData } = await supabase.storage
        .from('org-assets')
        .createSignedUrl(path, 3600)

      if (signedData?.signedUrl) {
        setSignedUrls((prev) => [...prev, { path, url: signedData.signedUrl }])
      }
    } catch (err) {
      setError('An unexpected error occurred during upload.')
      console.error('[PropertyPhotoUpload]', err)
    } finally {
      setUploading(false)
      // Reset file input so the same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      {/* Photo grid */}
      {signedUrls.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {signedUrls.map(({ path, url }) => (
            <div key={path} className="relative aspect-video overflow-hidden rounded-lg bg-stone-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Property photo"
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <div className="flex items-center gap-3">
        <label className="cursor-pointer">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={uploading}
            className="sr-only"
          />
          <span
            className={`inline-flex items-center rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 ${
              uploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            }`}
          >
            {uploading ? 'Uploading…' : 'Upload Photo'}
          </span>
        </label>
        <span className="text-xs text-stone-400">JPEG, PNG, or WebP · max 20 MB</span>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  )
}
