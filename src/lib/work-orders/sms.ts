// src/lib/work-orders/sms.ts
// SERVER ONLY — never import in 'use client' files.
// Pingram SMS wrapper for vendor job assignment notifications.
// T-05-15: PINGRAM_API_KEY is server-only; never NEXT_PUBLIC_.
// T-05-14: Pingram handles sender ID; carrier-level spoofing is outside app scope.

import { Pingram } from 'pingram'

/**
 * Normalize a phone number to E.164 format.
 * If the number doesn't start with '+', prepends '+1' (Canadian default).
 */
function toE164(phone: string): string {
  const stripped = phone.replace(/[\s\-().]/g, '')
  if (stripped.startsWith('+')) return stripped
  // Remove leading 1 if present before prepending +1
  if (stripped.startsWith('1') && stripped.length === 11) return `+${stripped}`
  return `+1${stripped}`
}

export interface SendVendorJobSMSParams {
  vendorPhone: string
  propertyAddress: string
  jobDescription: string
  noLoginLink: string
}

/**
 * sendVendorJobSMS — sends an SMS notification to a vendor via the Pingram API.
 *
 * Non-blocking: SMS failure does NOT throw. Errors are logged and swallowed
 * so that work order assignment proceeds regardless of SMS delivery status.
 * (RESEARCH.md Pitfall 5; D-11)
 *
 * Canadian region: uses region: 'ca' per Pingram client docs.
 */
export async function sendVendorJobSMS(params: SendVendorJobSMSParams): Promise<void> {
  const { vendorPhone, propertyAddress, jobDescription, noLoginLink } = params

  const apiKey = process.env.PINGRAM_API_KEY
  if (!apiKey) {
    console.warn('[sms:vendor_job_assignment] PINGRAM_API_KEY not set — skipping SMS')
    return
  }

  const phoneE164 = toE164(vendorPhone)
  const orgPhone = process.env.ORG_PHONE ?? '(613) 555-0100'

  const message = [
    'New job from Canary Property Management:',
    `Property: ${propertyAddress}`,
    `Job: ${jobDescription}`,
    `View + update status: ${noLoginLink}`,
    `Questions? Call us at ${orgPhone}`,
  ].join('\n')

  try {
    // Canadian region — routes to api.ca.pingram.io
    const client = new Pingram({ apiKey, region: 'ca' })

    await client.send({
      type: 'vendor_job_assignment',
      to: {
        id: phoneE164,
        number: phoneE164,
      },
      sms: {
        message,
      },
    })
  } catch (err) {
    // T-05-14: SMS failure must not block work order assignment
    console.error('[sms:vendor_job_assignment]', err)
  }
}
