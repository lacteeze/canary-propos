// SERVER ONLY — never import in 'use client' files.
// Pingram email sender. Matches work-orders/sms.ts: PINGRAM_API_KEY + region 'ca'.
import { Pingram } from 'pingram'
import { render } from '@react-email/components'
import type { ReactElement } from 'react'
import { DEFAULT_EMAIL_FROM } from '@/lib/email/brand'

export interface SendPingramEmailOptions {
  /** Pingram notification type (must exist / be allowed in the dashboard). */
  type: string
  to: string
  subject: string
  template: ReactElement
  /** Display form: "Name <email@domain>" or bare email. */
  from?: string
  /**
   * Reply-To address(es). Bare email or "Name <email@domain>".
   * Mapped to Pingram `options.email.replyToAddresses`.
   */
  replyTo?: string | string[]
  /**
   * BCC address(es). Bare email or "Name <email@domain>".
   * Mapped to Pingram `options.email.bccAddresses`.
   */
  bcc?: string | string[]
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

/** Format a Reply-To / From style address: `"Name" <email>` or bare email. */
export function formatEmailAddress(email: string, name?: string | null): string {
  const trimmedEmail = email.trim()
  const trimmedName = name?.trim()
  if (!trimmedName) return trimmedEmail
  const safeName = trimmedName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"${safeName}" <${trimmedEmail}>`
}

function normalizeAddressList(value?: string | string[]): string[] | undefined {
  if (!value) return undefined
  const list = (Array.isArray(value) ? value : [value])
    .map((a) => a.trim())
    .filter(Boolean)
  return list.length > 0 ? list : undefined
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
  from = DEFAULT_EMAIL_FROM,
  replyTo,
  bcc,
}: SendPingramEmailOptions): Promise<SendPingramEmailResult> {
  const apiKey = process.env.PINGRAM_API_KEY
  if (!apiKey) {
    return { success: false, error: 'PINGRAM_API_KEY is not set' }
  }

  try {
    const html = await render(template)
    const { senderName, senderEmail } = parseFromHeader(from)
    const replyToAddresses = normalizeAddressList(replyTo)
    const bccAddresses = normalizeAddressList(bcc)
    const client = new Pingram({ apiKey, region: 'ca' })

    const emailOptions =
      replyToAddresses || bccAddresses
        ? {
            email: {
              ...(replyToAddresses ? { replyToAddresses } : {}),
              ...(bccAddresses ? { bccAddresses } : {}),
            },
          }
        : undefined

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
      ...(emailOptions ? { options: emailOptions } : {}),
    })

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown email error'
    console.error('[sendPingramEmail]', type, message)
    return { success: false, error: message }
  }
}
