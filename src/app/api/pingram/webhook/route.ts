/**
 * Pingram inbound SMS webhook — /api/pingram/webhook
 *
 * SECURITY (T-260824-01):
 * - Read raw body with req.text() BEFORE any JSON parse.
 * - verify() from pingram/webhooks on X-Pingram-Id/Signature/Timestamp.
 * - createAdminClient only after signature verification (called inside handleInboundSms).
 * - Unknown numbers are ignored with no reply (D-01).
 */
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { verify, WebhookSignatureError, WebhookTimestampError } from 'pingram/webhooks'
import { handleInboundSms } from '@/lib/sms/charge-capture'

type SmsInboundBody = {
  eventType?: string
  from?: string
  to?: string
  text?: string
  media?: Array<{ url: string; contentType?: string }>
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  const secret = process.env.PINGRAM_WEBHOOK_SECRET
  if (!secret) {
    console.error('[pingram/webhook] PINGRAM_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const id = req.headers.get('x-pingram-id') ?? ''
  const signature = req.headers.get('x-pingram-signature') ?? ''
  const timestamp = req.headers.get('x-pingram-timestamp') ?? ''

  let event: SmsInboundBody
  try {
    event = verify({
      payload: rawBody,
      headers: { id, signature, timestamp },
      secret,
    }) as SmsInboundBody
  } catch (err) {
    if (err instanceof WebhookSignatureError || err instanceof WebhookTimestampError) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    const message = err instanceof Error ? err.message : 'Invalid webhook'
    return NextResponse.json({ error: message }, { status: 401 })
  }

  if (event.eventType !== 'SMS_INBOUND') {
    return NextResponse.json({ received: true })
  }

  try {
    await handleInboundSms({
      from: event.from ?? '',
      to: event.to ?? '',
      text: event.text ?? '',
      media: event.media,
      pingramId: id,
    })
  } catch (err) {
    console.error('[pingram/webhook] handleInboundSms', err)
  }

  return NextResponse.json({ received: true })
}
