'use client'

import React, { useEffect, useState } from 'react'
import { ExternalLink, Home, Mail } from 'lucide-react'
import {
  assignInquiryToHome,
  listMatchingHomesForInquiry,
  sendMatchingHomesEmail,
  type MatchingHomeResult,
} from '@/app/actions/inquiries'

function formatRent(rent: number | null): string {
  if (rent == null) return '—'
  return `$${Math.round(rent).toLocaleString('en-CA')}`
}

function formatAvail(iso: string | null): string {
  if (!iso) return 'TBD'
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

type Props = {
  inquiryId: string
  /** When true, show one-click assign. */
  allowAssign?: boolean
  /** When true, show send-matching-homes email button. */
  allowEmail?: boolean
  onAssigned?: () => void
  onEmailed?: () => void
  compact?: boolean
}

export function MatchingHomesPanel({
  inquiryId,
  allowAssign = true,
  allowEmail = true,
  onAssigned,
  onEmailed,
  compact = false,
}: Props) {
  const [homes, setHomes] = useState<MatchingHomeResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setEmailStatus(null)
    void listMatchingHomesForInquiry(inquiryId).then((result) => {
      if (cancelled) return
      if (result.error) {
        setError(result.error)
        setHomes([])
      } else {
        setHomes(result.homes ?? [])
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [inquiryId])

  const listedCount = (homes ?? []).filter((h) => h.listingId).length

  async function offerHome(home: MatchingHomeResult) {
    setBusyId(home.propertyId)
    setError(null)
    const result = await assignInquiryToHome(inquiryId, {
      propertyId: home.propertyId,
      listingId: home.listingId,
    })
    setBusyId(null)
    if (result.error) {
      setError(result.error)
      return
    }
    onAssigned?.()
  }

  async function emailMatches() {
    setEmailBusy(true)
    setError(null)
    setEmailStatus(null)
    const result = await sendMatchingHomesEmail(inquiryId)
    setEmailBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    const n = result.sent ?? 0
    setEmailStatus(
      n === 1
        ? "Emailed 1 listed home (leasing BCC'd)."
        : `Emailed ${n} listed homes (leasing BCC'd).`,
    )
    onEmailed?.()
  }

  return (
    <div className={`cy-match-homes${compact ? ' is-compact' : ''}`}>
      <div className="cy-match-homes-head">
        <Home size={14} aria-hidden />
        <span>Matching available homes</span>
      </div>
      {loading && <p className="cy-pipeline-empty">Finding matches…</p>}
      {error && (
        <p className="cy-pipeline-error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}
      {emailStatus && !error ? (
        <p className="cy-match-homes-sent" role="status" style={{ marginTop: 8 }}>
          {emailStatus}
        </p>
      ) : null}
      {!loading && homes && homes.length === 0 && !error && (
        <p className="cy-pipeline-empty" style={{ marginTop: 8 }}>
          No listed or upcoming matches right now.
        </p>
      )}
      {!loading && homes && homes.length > 0 && (
        <>
          {allowEmail ? (
            <div className="cy-match-homes-email">
              <button
                type="button"
                className="cy-btn cy-btn-primary"
                disabled={emailBusy || listedCount === 0}
                onClick={() => void emailMatches()}
                title={
                  listedCount === 0
                    ? 'Only currently published listings can be emailed'
                    : 'Email listed matches to the inquirer (BCC leasing)'
                }
              >
                <Mail size={13} aria-hidden />
                {emailBusy
                  ? 'Sending…'
                  : listedCount === 0
                    ? 'No listed matches to email'
                    : `Email ${listedCount} listed match${listedCount === 1 ? '' : 'es'}`}
              </button>
              <p className="cy-match-homes-email-help">
                Sends on-brand listing cards to the inquirer. Nothing goes out until you click —
                leasing@canarypm.ca is BCC'd.
              </p>
            </div>
          ) : null}
          <ul className="cy-match-homes-list">
            {homes.map((home) => (
              <li key={home.propertyId} className="cy-match-homes-item">
                <div className="cy-match-homes-main">
                  <div className="cy-match-homes-addr">{home.address}</div>
                  <div className="cy-match-homes-meta">
                    <span>
                      {home.beds != null ? `${home.beds} bd` : '—'}
                      {' · '}
                      {home.baths != null ? `${home.baths} ba` : '—'}
                    </span>
                    <span>{formatRent(home.rent)}</span>
                    <span>{home.status}</span>
                    <span>Avail {formatAvail(home.availableFrom)}</span>
                  </div>
                </div>
                <div className="cy-match-homes-actions">
                  {home.href && home.href !== '#' ? (
                    <a
                      className="cy-btn"
                      href={home.href}
                      target="_blank"
                      rel="noreferrer"
                      title="Open public page"
                    >
                      <ExternalLink size={13} aria-hidden />
                    </a>
                  ) : null}
                  {allowAssign ? (
                    <button
                      type="button"
                      className="cy-btn cy-btn-primary"
                      disabled={busyId === home.propertyId}
                      onClick={() => void offerHome(home)}
                    >
                      {busyId === home.propertyId ? '…' : 'Offer'}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
