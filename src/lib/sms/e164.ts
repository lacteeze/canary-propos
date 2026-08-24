/**
 * Normalize a phone number to E.164. Default country code +1 (Canada).
 */
export function toE164(phone: string): string {
  const stripped = phone.replace(/[\s\-().]/g, '')
  if (stripped.startsWith('+')) return stripped
  if (stripped.startsWith('1') && stripped.length === 11) return `+${stripped}`
  return `+1${stripped}`
}

function last10Digits(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10)
}

/** Compare phones ignoring formatting; E.164 or last-10-digit match. */
export function phonesEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  if (toE164(a) === toE164(b)) return true
  const da = last10Digits(a)
  const db = last10Digits(b)
  return da.length === 10 && da === db
}
