const STREET_SUFFIX =
  '(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|blvd|boulevard|crescent|cres|way|place|pl)'

/**
 * Normalize a confirmed job note into a learnable shorthand.
 * Returns null when the leftover is too generic (e.g. just "charge").
 */
export function normalizeJobPhrase(text: string): string | null {
  let s = (text || '').toLowerCase()
  s = s.replace(/\$[0-9]+(?:\.[0-9]{1,2})?/g, ' ')
  s = s.replace(/[0-9]+(?:\.[0-9]+)?\s*(?:hours?|hrs?)/g, ' ')
  s = s.replace(new RegExp(`\\b\\d+[a-z]?\\s+[a-z]+(?:\\s+${STREET_SUFFIX})?\\b`, 'g'), ' ')
  s = s.replace(/\b(charge|bill|billed|posted|plus|of|time|to|in)\b/g, ' ')
  s = s.replace(/[^a-z0-9\s]/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  if (!s) return null
  const tokens = s.split(/\s+/).filter(Boolean)
  if (tokens.length < 2 || s.length < 6) return null
  return s
}

export async function upsertPhrase(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  input: {
    orgId: string
    originalText: string
    category: string | null
    typicalHours: number
    typicalSuppliesCost: number
  }
): Promise<void> {
  const normalized = normalizeJobPhrase(input.originalText)
  if (!normalized) return

  const { data: existing } = await supabase
    .from('sms_charge_phrases')
    .select('id, hit_count')
    .eq('org_id', input.orgId)
    .eq('normalized_phrase', normalized)
    .maybeSingle()

  const now = new Date().toISOString()
  if (existing?.id) {
    await supabase
      .from('sms_charge_phrases')
      .update({
        category: input.category,
        typical_hours: input.typicalHours,
        typical_supplies_cost: input.typicalSuppliesCost,
        hit_count: Number(existing.hit_count ?? 1) + 1,
        last_confirmed_at: now,
      })
      .eq('id', existing.id)
    return
  }

  await supabase.from('sms_charge_phrases').insert({
    org_id: input.orgId,
    normalized_phrase: normalized,
    category: input.category,
    typical_hours: input.typicalHours,
    typical_supplies_cost: input.typicalSuppliesCost,
    hit_count: 1,
    last_confirmed_at: now,
  })
}
