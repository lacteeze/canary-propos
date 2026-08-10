'use client'

import { useState } from 'react'
import { propertyPublicHref } from '@/lib/listings/listing-href'
import { CopyIcon } from './CopyIcon'

type CopyPublicLinkButtonProps = {
  slug: string | null | undefined
  /** Compact chip style for photo cards */
  compact?: boolean
  className?: string
  style?: React.CSSProperties
}

export function CopyPublicLinkButton({
  slug,
  compact,
  className,
  style,
}: CopyPublicLinkButtonProps) {
  const [copied, setCopied] = useState(false)
  const href = propertyPublicHref({ slug }, { absolute: true })
  if (!href) return null
  const publicUrl = href
  const label = copied ? 'Copied' : 'Copy'

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      window.prompt('Copy public link:', publicUrl)
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        className={className}
        onClick={handleCopy}
        aria-label={label}
        title={copied ? 'Copied' : href}
        style={{
          border: '1px solid var(--border)',
          background: 'var(--elev)',
          color: 'var(--text)',
          borderRadius: 8,
          padding: 6,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          lineHeight: 0,
          ...style,
        }}
      >
        <CopyIcon size={13} />
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', ...style }}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: 'var(--blue, #2563eb)',
          fontSize: 12.5,
          fontWeight: 600,
          textDecoration: 'none',
          wordBreak: 'break-all',
        }}
      >
        {href.replace(/^https?:\/\//, '')}
      </a>
      <button
        type="button"
        className={className}
        onClick={handleCopy}
        aria-label={label}
        title={label}
        style={{
          border: '1px solid var(--border)',
          background: 'var(--input)',
          color: 'var(--text)',
          borderRadius: 999,
          padding: 6,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flex: 'none',
          lineHeight: 0,
        }}
      >
        <CopyIcon size={14} />
      </button>
    </div>
  )
}
