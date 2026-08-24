import { Pingram } from 'pingram'
import { toE164 } from '@/lib/sms/e164'

export async function sendChargeCaptureSms(input: { to: string; message: string }): Promise<void> {
  const apiKey = process.env.PINGRAM_API_KEY
  if (!apiKey) {
    console.warn('[sms:sms_charge_capture] PINGRAM_API_KEY not set — skipping SMS')
    return
  }

  try {
    const client = new Pingram({ apiKey, region: 'ca' })
    const phoneE164 = toE164(input.to)
    await client.send({
      type: 'sms_charge_capture',
      to: {
        id: phoneE164,
        number: phoneE164,
      },
      sms: {
        message: input.message,
      },
    })
  } catch (err) {
    console.error('[sms:sms_charge_capture]', err)
  }
}
