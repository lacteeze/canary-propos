// src/lib/email/send.ts
// SERVER ONLY — never import in 'use client' files.
// Resend email sender utility. Reads RESEND_API_KEY server-side (T-06-04).
import { Resend } from 'resend'
import { render } from '@react-email/components'
import type { ReactElement } from 'react'

// RESEND_API_KEY must be set in .env.local (server-only, never NEXT_PUBLIC_)
function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set.')
  }
  return new Resend(apiKey)
}

export interface SendEmailOptions {
  to: string
  subject: string
  template: ReactElement
  from?: string // defaults to noreply@canarypm.ca
}

export interface SendEmailResult {
  success: boolean
  error?: string
}

export async function sendEmail({
  to,
  subject,
  template,
  from = 'Canary PropOS <noreply@canarypm.ca>',
}: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const resend = getResendClient()
    const html = await render(template)

    const { error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    })

    if (error) {
      console.error('[sendEmail] Resend error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown email error'
    console.error('[sendEmail] Unexpected error:', message)
    return { success: false, error: message }
  }
}
