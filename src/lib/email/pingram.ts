// SERVER ONLY — never import in 'use client' files.
// Pingram email sender. Matches work-orders/sms.ts: PINGRAM_API_KEY + region 'ca'.
import { Pingram } from 'pingram'
import { render } from '@react-email/components'
import type { ReactElement } from 'react'

export interface SendPingramEmailOptions {
  /** Pingram notification type (must exist / be allowed in the dashboard). */
  type: string
  to: string
  subject: string
  template: ReactElement
  /** Display form: "Name <email@domain>" or bare email. */
  from?: string
}

export interface SendPingramEmailResult {
  success: boolean
  error?: string
}

function parseFromHeader(from: string): { senderName?: string; senderEmail: string } {
  const match = from.match(/^\s*(.+?)\s*<([^>]+)>\s*$/)
  if (match) {
    return { senderName: match[1].trim(), senderEmail: match[2].trim() }
  }
  return { senderEmail: from.trim() }
}

/**
 * sendPingramEmail — render a React Email template to HTML and deliver via Pingram.
 * Returns success/error; does not throw on API failure.
 */
export async function sendPingramEmail({
  type,
  to,
  subject,
  template,
  from = 'Canary PropOS <notifications@canarypm.ca>',
}: SendPingramEmailOptions): Promise<SendPingramEmailResult> {
  const apiKey = process.env.PINGRAM_API_KEY
  if (!apiKey) {
    return { success: false, error: 'PINGRAM_API_KEY is not set' }
  }

  try {
    const html = await render(template)
    const { senderName, senderEmail } = parseFromHeader(from)
    const client = new Pingram({ apiKey, region: 'ca' })

    await client.send({
      type,
      to: {
        id: to,
        email: to,
      },
      email: {
        subject,
        html,
        ...(senderName ? { senderName } : {}),
        senderEmail,
      },
    })

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown email error'
    console.error('[sendPingramEmail]', type, message)
    return { success: false, error: message }
  }
}
