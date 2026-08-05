'use client'

// Google Tasks Integration row — rendered inside the Integrations card

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  getGoogleTasksConnectUrl,
  disconnectGoogleTasks,
} from '@/app/(manager)/settings/actions'
import { syncGoogleTasks } from '@/app/actions/org-tasks'

interface GoogleTasksIntegrationSectionProps {
  orgId: string
  tasksConnectedAt: string | null
}

export function GoogleTasksIntegrationSection({
  orgId,
  tasksConnectedAt,
}: GoogleTasksIntegrationSectionProps) {
  const searchParams = useSearchParams()
  const [isConnected, setIsConnected] = useState(tasksConnectedAt !== null)
  const [connectedAt] = useState(tasksConnectedAt)
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const tasksParam = searchParams.get('tasks')
    if (tasksParam === 'connected') {
      toast.success('Google Tasks connected successfully.')
      setIsConnected(true)
    } else if (tasksParam === 'error') {
      const reason = searchParams.get('reason')
      const message =
        reason === 'token_exchange'
          ? 'Google Tasks authorization failed. Please try again.'
          : 'Failed to connect Google Tasks. Please try again.'
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
      const result = await getGoogleTasksConnectUrl()
      if (!result.success || !result.url) {
        const message =
          (!result.success ? result.error : undefined) ??
          'Failed to start Google Tasks authorization. Check OAuth env vars and that /api/google-tasks/callback is registered.'
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
          : 'Failed to start Google Tasks authorization.'
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
      const result = await disconnectGoogleTasks(orgId)
      if (!result.success) {
        const message = result.error ?? 'Failed to disconnect Google Tasks.'
        setActionError(message)
        toast.error(message)
        setBusy(false)
        return
      }
      setIsConnected(false)
      toast.success('Google Tasks disconnected.')
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to disconnect Google Tasks.'
      setActionError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSync() {
    if (syncing) return
    setSyncing(true)
    setActionError(null)
    try {
      const result = await syncGoogleTasks()
      if (!result.success) {
        const message = result.error ?? 'Sync failed.'
        setActionError(message)
        toast.error(message)
        return
      }
      const { imported = 0, updated = 0 } = result.data ?? {}
      toast.success(
        `Google Tasks sync complete — ${imported} imported, ${updated} updated.`,
      )
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : 'Sync failed.'
      setActionError(message)
      toast.error(message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="cy-settings-integration" style={{ marginTop: 14 }}>
      <div className="cy-settings-integration-main">
        <div className="cy-settings-integration-title">
          <span>Google Tasks</span>
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
            . Import incomplete tasks into the Team tasks board in Canary.
          </p>
        ) : (
          <p className="cy-settings-help">
            Connect Google Tasks to import incomplete tasks into the Canary Team tasks board.
          </p>
        )}
        {actionError && (
          <p className="cy-settings-error" role="alert" style={{ marginTop: 8 }}>
            {actionError}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {isConnected && (
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={busy || syncing}
            className="cy-btn cy-btn--active"
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        )}
        {isConnected ? (
          <button
            type="button"
            onClick={() => void handleDisconnect()}
            disabled={busy || syncing}
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
            {busy ? 'Redirecting…' : 'Connect Google Tasks'}
          </button>
        )}
      </div>
    </div>
  )
}
