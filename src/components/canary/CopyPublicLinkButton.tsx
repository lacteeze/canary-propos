'use client'

import { useState } from 'react'
import { propertyPublicHref } from '@/lib/listings/listing-href'

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
        title={href}
        style={{
          border: '1px solid var(--border)',
          background: 'var(--elev)',
          color: 'var(--text)',
          borderRadius: 8,
          padding: '4px 8px',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          ...style,
        }}
      >
        {copied ? 'Copied' : 'Copy link'}
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
        style={{
          border: '1px solid var(--border)',
          background: 'var(--input)',
          color: 'var(--text)',
          borderRadius: 999,
          padding: '4px 10px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          flex: 'none',
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
