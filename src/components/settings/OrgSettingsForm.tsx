// src/components/settings/OrgSettingsForm.tsx
// Org settings form — name, logo upload, province — Canary shell styling
'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { CANADIAN_PROVINCES } from '@/lib/constants/provinces'
import { updateOrgProfile } from '@/app/(manager)/settings/actions'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 // 2MB

interface OrgSettingsFormProps {
  orgId: string
  initialName: string
  initialSlug: string
  initialProvince: string
  initialLogoPath: string | null
  initialLogoUrl: string | null
}

function extensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

export function OrgSettingsForm({
  orgId,
  initialName,
  initialSlug,
  initialProvince,
  initialLogoPath,
  initialLogoUrl,
}: OrgSettingsFormProps) {
  const [name, setName] = useState(initialName)
  const [slug, setSlug] = useState(initialSlug)
  const [province, setProvince] = useState(initialProvince)
  const [logoPath, setLogoPath] = useState<string | null>(initialLogoPath)
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
  const [error, setError] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updateOrgProfile({ name, slug, province, logoPath })
      if (result.success) {
        toast.success('Changes saved')
      } else {
        setError(result.error)
        toast.error(result.error)
      }
    })
  }

  async function handleLogoSelected(file: File | undefined) {
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      const message = 'Please upload a PNG, JPEG, or WebP image.'
      setError(message)
      toast.error(message)
      return
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const message = 'Logo must be 2MB or smaller.'
      setError(message)
      toast.error(message)
      return
    }

    setUploadingLogo(true)
    setError(null)

    try {
      const supabase = createClient()
      const ext = extensionForMime(file.type)
      const storagePath = `${orgId}/branding/logo-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('org-assets')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: true,
          cacheControl: '31536000',
        })

      if (uploadError) {
        throw new Error(uploadError.message || 'Upload failed.')
      }

      const saveResult = await updateOrgProfile({
        name,
        slug,
        province,
        logoPath: storagePath,
      })
      if (!saveResult.success) {
        throw new Error(saveResult.error)
      }

      // Remove previous logo when it lived under this org's branding folder.
      if (
        logoPath &&
        logoPath !== storagePath &&
        logoPath.startsWith(`${orgId}/branding/`)
      ) {
        await supabase.storage.from('org-assets').remove([logoPath])
      }

      const { data: signed } = await supabase.storage
        .from('org-assets')
        .createSignedUrl(storagePath, 3600)

      setLogoPath(storagePath)
      setLogoUrl(signed?.signedUrl ?? URL.createObjectURL(file))
      toast.success('Logo updated')
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to upload logo.'
      setError(message)
      toast.error(message)
    } finally {
      setUploadingLogo(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveLogo() {
    if (!logoPath || uploadingLogo) return
    setUploadingLogo(true)
    setError(null)
    try {
      const saveResult = await updateOrgProfile({
        name,
        slug,
        province,
        logoPath: null,
      })
      if (!saveResult.success) {
        throw new Error(saveResult.error)
      }

      if (logoPath.startsWith(`${orgId}/`) && !logoPath.startsWith('pending/')) {
        const supabase = createClient()
        await supabase.storage.from('org-assets').remove([logoPath])
      }

      setLogoPath(null)
      setLogoUrl(null)
      toast.success('Logo removed')
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to remove logo.'
      setError(message)
      toast.error(message)
    } finally {
      setUploadingLogo(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="cy-settings-stack">
      <section className="cy-section-card cy-settings-card">
        <h2 className="cy-section-title">Organization name</h2>
        <label htmlFor="settings-name" className="cy-label">
          Name
        </label>
        <input
          id="settings-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={80}
          placeholder="e.g. Harbourview Holdings"
          className="cy-input"
        />
        <label htmlFor="settings-slug" className="cy-label" style={{ marginTop: 14 }}>
          Public slug
        </label>
        <input
          id="settings-slug"
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          required
          minLength={2}
          maxLength={60}
          placeholder="harbourview"
          className="cy-input"
        />
        <p className="cy-settings-help">Used in your public listing URLs.</p>
        <div className="cy-settings-actions">
          <button type="submit" disabled={isPending || uploadingLogo} className="cy-btn cy-btn--active">
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </section>

      <section className="cy-section-card cy-settings-card">
        <h2 className="cy-section-title">Logo</h2>
        <div className="cy-settings-logo-row">
          <button
            type="button"
            className="cy-settings-logo-stub"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingLogo}
            aria-label="Upload organization logo"
            style={
              logoUrl
                ? {
                    backgroundImage: `url(${logoUrl})`,
                    backgroundSize: 'contain',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    color: 'transparent',
                  }
                : undefined
            }
          >
            {logoUrl ? 'Change logo' : uploadingLogo ? 'Uploading…' : 'Upload logo'}
          </button>
          <div>
            <p className="cy-settings-help">
              Your logo appears on tenant portals, email communications, and as the browser
              favicon.
            </p>
            <p className="cy-settings-help" style={{ marginTop: 6 }}>
              PNG, JPEG, or WebP — max 2MB
            </p>
            <div className="cy-settings-actions" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="cy-btn cy-btn--active"
                disabled={uploadingLogo}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingLogo ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  className="cy-btn"
                  disabled={uploadingLogo}
                  onClick={() => void handleRemoveLogo()}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            className="sr-only"
            aria-label="Logo file input"
            onChange={(e) => void handleLogoSelected(e.target.files?.[0])}
          />
        </div>
      </section>

      <section className="cy-section-card cy-settings-card">
        <h2 className="cy-section-title">Province or Territory</h2>
        <label htmlFor="settings-province" className="cy-label">
          Where do you operate?
        </label>
        <select
          id="settings-province"
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          required
          className="cy-input"
        >
          <option value="" disabled>
            Select province or territory
          </option>
          {CANADIAN_PROVINCES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <div className="cy-settings-actions">
          <button type="submit" disabled={isPending || uploadingLogo} className="cy-btn cy-btn--active">
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </section>

      <section className="cy-section-card cy-settings-card">
        <h2 className="cy-section-title">
          Branding color <span className="cy-settings-soon">Coming soon</span>
        </h2>
        <label htmlFor="settings-brand-color" className="cy-label">
          Brand color
        </label>
        <input
          id="settings-brand-color"
          type="text"
          disabled
          placeholder="#D97706"
          className="cy-input"
        />
      </section>

      {error && (
        <p className="cy-settings-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
