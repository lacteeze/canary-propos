'use client'

import { useState } from 'react'
import { CopyIcon } from '@/components/canary/CopyIcon'

function publicRentUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://canarypm.ca').replace(/\/$/, '')
  return `${base}/rent`
}

/** Manager-facing share link for the public general-interest form at /rent. */
export function InterestFormShareCard() {
  const [copied, setCopied] = useState(false)
  const url = publicRentUrl()
  const display = url.replace(/^https?:\/\//, '')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      window.prompt('Copy share link:', url)
    }
  }

  return (
    <section className="cy-section-card cy-settings-card">
      <h2 className="cy-section-title">Interest form</h2>
      <p className="cy-settings-help">
        Shareable link for the public “Tell us what you&apos;re looking for” form. Post it in
        ads, email, or social — submissions show up in Leasing inquiries.
      </p>
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--blue, #2563eb)',
            fontSize: 13.5,
            fontWeight: 600,
            textDecoration: 'none',
            wordBreak: 'break-all',
          }}
        >
          {display}
        </a>
        <button
          type="button"
          className="cy-btn cy-btn--active"
          onClick={() => void handleCopy()}
          aria-label={copied ? 'Copied' : 'Copy'}
          title={copied ? 'Copied' : 'Copy'}
          style={{
            padding: 8,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 0,
          }}
        >
          <CopyIcon size={15} />
        </button>
      </div>
    </section>
  )
}
