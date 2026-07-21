'use client'

// Gmail Integration section — Canary shell styling

import { useState, useTransition, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { getGmailConnectUrl, disconnectGmail } from '@/app/(manager)/settings/actions'

interface GmailIntegrationSectionProps {
  orgId: string
  gmailConnectedAt: string | null
}

export function GmailIntegrationSection({
  orgId,
  gmailConnectedAt,
}: GmailIntegrationSectionProps) {
  const searchParams = useSearchParams()
  const [isConnected, setIsConnected] = useState(gmailConnectedAt !== null)
  const [connectedAt] = useState(gmailConnectedAt)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const gmailParam = searchParams.get('gmail')
    if (gmailParam === 'connected') {
      toast.success('Gmail connected successfully.')
      setIsConnected(true)
    } else if (gmailParam === 'error') {
      const reason = searchParams.get('reason')
      toast.error(
        reason === 'token_exchange'
          ? 'Gmail authorization failed. Please try again.'
          : 'Failed to connect Gmail. Please try again.',
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleConnect() {
    startTransition(async () => {
      const result = await getGmailConnectUrl()
      if (!result.success || !result.url) {
        toast.error(
          (!result.success ? (result as { error?: string }).error : undefined) ??
            'Failed to start Gmail authorization.',
        )
        return
      }
      window.location.href = result.url
    })
  }

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectGmail(orgId)
      if (!result.success) {
        toast.error(result.error ?? 'Failed to disconnect Gmail.')
        return
      }
      setIsConnected(false)
      toast.success('Gmail disconnected.')
    })
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
            {isPending ? 'Redirecting…' : 'Connect Gmail'}
          </button>
        )}
      </div>
    </section>
  )
}
