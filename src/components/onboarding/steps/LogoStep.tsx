'use client'

import { useState, useRef } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    const url = URL.createObjectURL(selected)
    setPreview(url)
  }

  function handleRemove() {
    setPreview(null)
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleContinue() {
    // If no file selected, continue without logo (treated same as skip)
    if (!file) {
      onNext(null)
      return
    }
    // Pass the file name as placeholder — actual upload happens client-side
    // The onNext callback receives null here; real upload is handled in page.tsx
    onNext(file.name)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-[1.25rem] font-semibold leading-tight text-stone-900">
          Add your logo
        </h2>
        <p className="text-stone-500">
          Your logo appears on tenant portals and email communications.
        </p>
      </div>

      {/* Upload area */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Upload organization logo"
          className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-stone-300 bg-stone-50 transition-colors hover:border-stone-400 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
        >
          {preview ? (
            <Avatar className="h-20 w-20">
              <AvatarImage src={preview} alt="Organization logo preview" />
              <AvatarFallback>
                <Upload className="h-6 w-6 text-stone-400" aria-hidden="true" />
              </AvatarFallback>
            </Avatar>
          ) : (
            <Upload className="h-6 w-6 text-stone-400" aria-hidden="true" />
          )}
        </button>

        {preview && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-sm text-red-600 underline-offset-4 hover:underline"
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
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <p className="text-xs text-stone-400">PNG, JPEG, or WebP — max 2MB</p>
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          onClick={handleContinue}
          disabled={isLoading}
          className="min-h-11 w-full font-semibold"
          style={{ backgroundColor: '#D97706', color: '#ffffff' }}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Saving...
            </>
          ) : (
            'Continue'
          )}
        </Button>

        <button
          type="button"
          onClick={onSkip}
          disabled={isLoading}
          className="block w-full text-center text-sm text-stone-500 underline-offset-4 hover:underline"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
