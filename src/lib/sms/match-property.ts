export type PropertyMatch = { id: string; street_address: string }

function streetNumber(text: string): string | null {
  const m = text.toLowerCase().match(/\b(\d+[a-z]?)\b/)
  return m?.[1] ?? null
}

function nameTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !/^\d/.test(t))
}

/**
 * Fuzzy-match a freeform address hint against org properties.
 * Street number (when present) plus a >=4-char street-name token, or a unique street-number hit.
 */
export function matchProperties(hint: string, properties: PropertyMatch[]): PropertyMatch[] {
  const raw = (hint || '').trim()
  if (!raw || properties.length === 0) return []

  const hintNumber = streetNumber(raw)
  const tokens = nameTokens(raw)

  const both: PropertyMatch[] = []
  const nameOnly: PropertyMatch[] = []
  const numberOnly: PropertyMatch[] = []

  for (const p of properties) {
    const addr = p.street_address.toLowerCase()
    const addrNumber = streetNumber(p.street_address)
    const nameHit = tokens.some((t) => addr.includes(t))
    const numberHit = Boolean(hintNumber && addrNumber === hintNumber)
    if (hintNumber && numberHit && nameHit) both.push(p)
    else if (!hintNumber && nameHit) nameOnly.push(p)
    if (numberHit) numberOnly.push(p)
  }

  if (hintNumber && tokens.length > 0) {
    if (both.length > 0) return both.slice(0, 5)
    if (numberOnly.length === 1) return numberOnly
    return []
  }
  if (hintNumber && tokens.length === 0) {
    return numberOnly.length === 1 ? numberOnly : numberOnly.slice(0, 5)
  }
  return nameOnly.slice(0, 5)
}
