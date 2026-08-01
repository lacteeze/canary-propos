'use client'

// Google Drive Integration row — rendered inside the Integrations card

import { useState, useTransition, useEffect } from 'react'
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
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const driveParam = searchParams.get('drive')
    if (driveParam === 'connected') {
      toast.success('Google Drive connected successfully.')
      setIsConnected(true)
    } else if (driveParam === 'error') {
      const reason = searchParams.get('reason')
      toast.error(
        reason === 'token_exchange'
          ? 'Drive authorization failed. Please try again.'
          : 'Failed to connect Google Drive. Please try again.',
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleConnect() {
    startTransition(async () => {
      const result = await getDriveConnectUrl()
      if (!result.success || !result.url) {
        toast.error(
          (!result.success ? (result as { error?: string }).error : undefined) ??
            'Failed to start Drive authorization.',
        )
        return
      }
      window.location.href = result.url
    })
  }

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectDrive(orgId)
      if (!result.success) {
        toast.error(result.error ?? 'Failed to disconnect Google Drive.')
        return
      }
      setIsConnected(false)
      toast.success('Google Drive disconnected.')
    })
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
      </div>

      {isConnected ? (
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={isPending}
          className="cy-btn"
        >
          {isPending ? 'Disconnecting…' : 'Disconnect'}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleConnect}
          disabled={isPending}
          className="cy-btn cy-btn--active"
        >
          {isPending ? 'Redirecting…' : 'Connect Drive'}
        </button>
      )}
    </div>
  )
}
