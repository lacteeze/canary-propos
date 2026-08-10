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
        className={['cy-copy-icon-btn', className].filter(Boolean).join(' ')}
        onClick={handleCopy}
        aria-label={label}
        title={copied ? 'Copied' : 'Copy'}
        style={style}
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
        className={['cy-copy-icon-btn', className].filter(Boolean).join(' ')}
        onClick={handleCopy}
        aria-label={label}
        title={label}
      >
        <CopyIcon size={14} />
      </button>
    </div>
  )
}
