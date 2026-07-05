'use client'
// src/app/(owner-nologin)/owner/decline/[token]/DeclineForm.tsx
// Client component: renders decline form and handles submission via server action.

import { useState, useTransition } from 'react'
import { declineWorkOrderViaToken } from '@/app/actions/work-orders'

interface DeclineFormProps {
  token: string
}

export function DeclineForm({ token }: DeclineFormProps) {
  const [note, setNote] = useState('')
  const [declined, setDeclined] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (declined) {
    return (
      <div>
        <div style={{ ...iconCircleStyle, backgroundColor: '#78716C' }}>✓</div>
        <h1 style={headingStyle}>Work order declined</h1>
        <p style={messageStyle}>
          Canary Property Management has been notified. If you have questions, please contact them
          directly.
        </p>
      </div>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    startTransition(async () => {
      const result = await declineWorkOrderViaToken(token, note || undefined)
      if (result.success) {
        setDeclined(true)
      } else {
        setErrorMsg(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ ...iconCircleStyle, backgroundColor: '#DC2626' }}>✕</div>
      <h1 style={headingStyle}>Decline work order</h1>
      <p style={messageStyle}>
        You can optionally provide a reason for declining. This note will be sent to Canary
        Property Management.
      </p>

      <div style={fieldGroupStyle}>
        <label htmlFor="decline-note" style={labelStyle}>
          Reason for declining (optional)
        </label>
        <textarea
          id="decline-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Please get a second quote first."
          rows={4}
          style={textareaStyle}
          disabled={isPending}
        />
      </div>

      {errorMsg && <p style={errorStyle}>{errorMsg}</p>}

      <button type="submit" disabled={isPending} style={submitButtonStyle}>
        {isPending ? 'Processing...' : 'Confirm Decline'}
      </button>
    </form>
  )
}

// --- Inline styles ---

const iconCircleStyle: React.CSSProperties = {
  borderRadius: '50%',
  color: '#ffffff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '28px',
  fontWeight: '700',
  height: '64px',
  lineHeight: '1',
  marginBottom: '20px',
  width: '64px',
}

const headingStyle: React.CSSProperties = {
  color: '#1C1917',
  fontSize: '20px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '0 0 12px 0',
}

const messageStyle: React.CSSProperties = {
  color: '#78716C',
  fontSize: '15px',
  lineHeight: '1.5',
  margin: '0 0 20px 0',
}

const fieldGroupStyle: React.CSSProperties = {
  marginBottom: '16px',
  textAlign: 'left',
}

const labelStyle: React.CSSProperties = {
  color: '#44403C',
  display: 'block',
  fontSize: '14px',
  fontWeight: '500',
  marginBottom: '6px',
}

const textareaStyle: React.CSSProperties = {
  border: '1px solid #D6D3D1',
  borderRadius: '6px',
  color: '#1C1917',
  fontSize: '15px',
  lineHeight: '1.5',
  padding: '10px 12px',
  resize: 'vertical',
  width: '100%',
  boxSizing: 'border-box',
}

const errorStyle: React.CSSProperties = {
  color: '#DC2626',
  fontSize: '14px',
  marginBottom: '12px',
}

const submitButtonStyle: React.CSSProperties = {
  backgroundColor: '#DC2626',
  border: 'none',
  borderRadius: '6px',
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: '15px',
  fontWeight: '600',
  height: '44px',
  padding: '0 24px',
  width: '100%',
}
