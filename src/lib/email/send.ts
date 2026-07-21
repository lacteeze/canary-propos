// SERVER ONLY — never import in 'use client' files.
// Shared transactional email entry point — delivers via Pingram (not Resend).
import type { ReactElement } from 'react'
import { sendPingramEmail, type SendPingramEmailResult } from '@/lib/email/pingram'

export type SendEmailResult = SendPingramEmailResult

export interface SendEmailOptions {
  /** Pingram notification type — must be allowed in the Pingram dashboard. */
  type: string
  to: string
  subject: string
  template: ReactElement
  from?: string
}

/**
 * sendEmail — render a React Email template and deliver via Pingram (region ca).
 * Requires PINGRAM_API_KEY. Returns success/error; does not throw on API failure.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  return sendPingramEmail(opts)
}
