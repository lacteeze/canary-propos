'use client'

// Google Drive Integration row — rendered inside the Integrations card

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { getDriveConnectUrl, disconnectDrive } from '@/app/(manager)/settings/actions'

interface DriveIntegrationSectionProps {
  orgId: string
  driveConnectedAt: string | null
}

export function DriveIntegrationSection({
  orgId,
  driveConnectedAt,
}: DriveIntegrationSectionProps) {
  const searchParams = useSearchParams()
  const [isConnected, setIsConnected] = useState(driveConnectedAt !== null)
  const [connectedAt] = useState(driveConnectedAt)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const driveParam = searchParams.get('drive')
    if (driveParam === 'connected') {
      toast.success('Google Drive connected successfully.')
      setIsConnected(true)
    } else if (driveParam === 'error') {
      const reason = searchParams.get('reason')
      const message =
        reason === 'token_exchange'
          ? 'Drive authorization failed. Please try again.'
          : 'Failed to connect Google Drive. Please try again.'
      toast.error(message)
      setActionError(message)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleConnect() {
    if (busy) return
    setBusy(true)
    setActionError(null)
    try {
      const result = await getDriveConnectUrl()
      if (!result.success || !result.url) {
        const message =
          (!result.success ? result.error : undefined) ??
          'Failed to start Drive authorization. Check Google OAuth env vars and that /api/drive/callback is registered.'
        setActionError(message)
        toast.error(message)
        setBusy(false)
        return
      }
      // Full navigation — do not clear busy (page is leaving).
      window.location.assign(result.url)
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to start Drive authorization.'
      setActionError(message)
      toast.error(message)
      setBusy(false)
    }
  }

  async function handleDisconnect() {
    if (busy) return
    setBusy(true)
    setActionError(null)
    try {
      const result = await disconnectDrive(orgId)
      if (!result.success) {
        const message = result.error ?? 'Failed to disconnect Google Drive.'
        setActionError(message)
        toast.error(message)
        setBusy(false)
        return
      }
      setIsConnected(false)
      toast.success('Google Drive disconnected.')
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to disconnect Google Drive.'
      setActionError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cy-settings-integration" style={{ marginTop: 14 }}>
      <div className="cy-settings-integration-main">
        <div className="cy-settings-integration-title">
          <span>Google Drive</span>
          {isConnected && <span className="cy-inbox-chip cy-inbox-chip--prop">Connected</span>}
        </div>
        {isConnected && connectedAt ? (
          <p className="cy-settings-help">
            Connected on{' '}
            {new Date(connectedAt).toLocaleDateString('en-CA', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        ) : (
          <p className="cy-settings-help">
            Connect Google Drive to browse and import property photos, and optionally sync a
            linked folder per property.
          </p>
        )}
        {actionError && (
          <p className="cy-settings-error" role="alert" style={{ marginTop: 8 }}>
            {actionError}
          </p>
        )}
      </div>

      {isConnected ? (
        <button
          type="button"
          onClick={() => void handleDisconnect()}
          disabled={busy}
          className="cy-btn"
        >
          {busy ? 'Disconnecting…' : 'Disconnect'}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void handleConnect()}
          disabled={busy}
          className="cy-btn cy-btn--active"
        >
          {busy ? 'Redirecting…' : 'Connect Drive'}
        </button>
      )}
    </div>
  )
}
