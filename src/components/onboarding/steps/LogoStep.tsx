'use client'

import { useState, useRef } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 // 2MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

interface LogoStepProps {
  orgId?: string
  onNext: (logoPath: string | null) => void | Promise<void>
  onSkip: () => void
  isLoading?: boolean
}

export function LogoStep({ onNext, onSkip, isLoading }: LogoStepProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError('Please upload a PNG, JPEG, or WebP image.')
      return
    }
    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setError('Image must be 2MB or smaller.')
      return
    }

    setError(null)
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
  }

  function handleRemove() {
    setPreview(null)
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleContinue() {
    if (!file) {
      onNext(null)
      return
    }
    onNext(file.name)
  }

  return (
    <div>
      <h2 className="onboard-title">Add your logo</h2>
      <p className="onboard-sub">
        Your logo appears on tenant portals and email communications.
      </p>

      <div className="flex flex-col items-center gap-3" style={{ marginBottom: 22 }}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Upload organization logo"
          className="onboard-logo-btn"
        >
          {preview ? (
            <Avatar className="h-20 w-20">
              <AvatarImage src={preview} alt="Organization logo preview" />
              <AvatarFallback>
                <Upload className="h-6 w-6" style={{ color: 'var(--faint)' }} aria-hidden="true" />
              </AvatarFallback>
            </Avatar>
          ) : (
            <Upload className="h-6 w-6" style={{ color: 'var(--faint)' }} aria-hidden="true" />
          )}
        </button>

        {preview && (
          <button
            type="button"
            onClick={handleRemove}
            className="onboard-skip"
            style={{ color: 'var(--red)', textDecoration: 'underline' }}
          >
            Remove
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="sr-only"
          aria-label="Logo file input"
          onChange={handleFileChange}
        />

        {error && (
          <p role="alert" className="text-sm" style={{ color: 'var(--red)' }}>
            {error}
          </p>
        )}

        <p style={{ fontSize: 12, color: 'var(--faint)', margin: 0 }}>
          PNG, JPEG, or WebP — max 2MB
        </p>
      </div>

      <div className="onboard-actions">
        <button
          type="button"
          onClick={() => void handleContinue()}
          disabled={isLoading}
          className="auth-btn"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Saving...
            </>
          ) : (
            'Continue'
          )}
        </button>

        <button type="button" onClick={onSkip} disabled={isLoading} className="onboard-skip">
          Skip for now
        </button>
      </div>
    </div>
  )
}
