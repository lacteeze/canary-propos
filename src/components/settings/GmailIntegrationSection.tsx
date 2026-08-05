'use client'

// Integrations section — Gmail + Google Drive (Canary shell styling)

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { getGmailConnectUrl, disconnectGmail } from '@/app/(manager)/settings/actions'
import { DriveIntegrationSection } from '@/components/settings/DriveIntegrationSection'
import { GoogleTasksIntegrationSection } from '@/components/settings/GoogleTasksIntegrationSection'

interface GmailIntegrationSectionProps {
  orgId: string
  gmailConnectedAt: string | null
  driveConnectedAt?: string | null
  tasksConnectedAt?: string | null
}

export function GmailIntegrationSection({
  orgId,
  gmailConnectedAt,
  driveConnectedAt = null,
  tasksConnectedAt = null,
}: GmailIntegrationSectionProps) {
  const searchParams = useSearchParams()
  const [isConnected, setIsConnected] = useState(gmailConnectedAt !== null)
  const [connectedAt] = useState(gmailConnectedAt)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const gmailParam = searchParams.get('gmail')
    if (gmailParam === 'connected') {
      toast.success('Gmail connected successfully.')
      setIsConnected(true)
    } else if (gmailParam === 'error') {
      const reason = searchParams.get('reason')
      const message =
        reason === 'token_exchange'
          ? 'Gmail authorization failed. Please try again.'
          : 'Failed to connect Gmail. Please try again.'
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
      const result = await getGmailConnectUrl()
      if (!result.success || !result.url) {
        const message =
          (!result.success ? result.error : undefined) ??
          'Failed to start Gmail authorization.'
        setActionError(message)
        toast.error(message)
        setBusy(false)
        return
      }
      window.location.assign(result.url)
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to start Gmail authorization.'
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
      const result = await disconnectGmail(orgId)
      if (!result.success) {
        const message = result.error ?? 'Failed to disconnect Gmail.'
        setActionError(message)
        toast.error(message)
        setBusy(false)
        return
      }
      setIsConnected(false)
      toast.success('Gmail disconnected.')
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to disconnect Gmail.'
      setActionError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="cy-section-card cy-settings-card">
      <h2 className="cy-section-title">Integrations</h2>
      <p className="cy-settings-help" style={{ marginBottom: 14 }}>
        Connect external services to extend Canary PropOS.
      </p>

      <div className="cy-settings-integration">
        <div className="cy-settings-integration-main">
          <div className="cy-settings-integration-title">
            <span>Gmail</span>
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
              Connect Gmail to sync mail into the PropOS Email inbox and detect Interac e-transfer
              payments.
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
            {busy ? 'Redirecting…' : 'Connect Gmail'}
          </button>
        )}
      </div>

      <DriveIntegrationSection orgId={orgId} driveConnectedAt={driveConnectedAt} />
      <GoogleTasksIntegrationSection orgId={orgId} tasksConnectedAt={tasksConnectedAt} />
    </section>
  )
}