'use client'

// src/components/settings/GmailIntegrationSection.tsx
// Gmail Integration section for the Settings page.
// Allows managers to connect/disconnect their org Gmail account for
// Interac e-transfer detection (PAY-03).

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

  // Show toast on redirect back from OAuth flow
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
    // Only run on mount — intentionally omit searchParams from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleConnect() {
    startTransition(async () => {
      const result = await getGmailConnectUrl()
      if (!result.success || !result.url) {
        toast.error((!result.success ? (result as any).error : undefined) ?? 'Failed to start Gmail authorization.')
        return
      }
      // Redirect to Google OAuth consent screen
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
    <section className="mt-10 border-t border-stone-200 pt-8">
      <h2 className="mb-1 text-base font-semibold text-stone-900">Integrations</h2>
      <p className="mb-6 text-sm text-stone-500">
        Connect external services to extend Canary PropOS.
      </p>

      <div className="rounded-lg border border-stone-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-stone-900">Gmail</span>
              {isConnected && (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                  Connected
                </span>
              )}
            </div>
            {isConnected && connectedAt ? (
              <p className="mt-1 text-xs text-stone-500">
                Connected on{' '}
                {new Date(connectedAt).toLocaleDateString('en-CA', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            ) : (
              <p className="mt-1 text-xs text-stone-500">
                Connect your Gmail account to automatically detect Interac e-transfer payments from
                your inbox.
              </p>
            )}
          </div>

          <div className="shrink-0">
            {isConnected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isPending}
                className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:opacity-60"
              >
                {isPending ? 'Disconnecting…' : 'Disconnect'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={isPending}
                className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-stone-700 disabled:opacity-60"
              >
                {isPending ? 'Redirecting…' : 'Connect Gmail'}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
