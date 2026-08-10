const UUID =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

/** `https://booking.hospitable.com/widget/{siteUuid}/{propertyId}` (+ optional query/hash). */
const WIDGET_PATH_RE = new RegExp(
  `booking\\.hospitable\\.com/widget/(${UUID})/(\\d+)(?:[/?#]|$)`,
  'i',
)

/** Embed snippet: `data-property-id="870564"` (or single quotes / unquoted). */
const DATA_PROPERTY_ID_RE = /data-property-id\s*=\s*["']?(\d+)["']?/i

/**
 * Extract Hospitable Direct Booking numeric `data-property-id` from pasted input.
 *
 * Accepts:
 * - bare numeric IDs (`870564`)
 * - widget URLs (`…/widget/{siteUuid}/{propertyId}`)
 * - embed snippets containing `data-property-id="…"`
 *
 * Returns the property ID string for storage, or null if nothing usable was found.
 * Empty / whitespace-only input returns null (caller treats as clear).
 */
export function parseHospitableWidgetPropertyId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (/^\d+$/.test(trimmed)) return trimmed

  const pathMatch = trimmed.match(WIDGET_PATH_RE)
  if (pathMatch?.[2]) return pathMatch[2]

  const dataMatch = trimmed.match(DATA_PROPERTY_ID_RE)
  if (dataMatch?.[1]) return dataMatch[1]

  return null
}

/**
 * Extract site UUID from a Hospitable widget URL path, if present.
 * Useful for validation against `HOSPITABLE_SITE_UUID`; not required for storage.
 */
export function parseHospitableWidgetSiteUuid(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const pathMatch = trimmed.match(WIDGET_PATH_RE)
  return pathMatch?.[1]?.toLowerCase() ?? null
}

/**
 * Normalize a form value for the widget property ID field.
 * Blank → empty string; parsable paste → digits; otherwise original trimmed text
 * (so validation can still reject garbage).
 */
export function normalizeHospitableWidgetPropertyIdInput(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  return parseHospitableWidgetPropertyId(trimmed) ?? trimmed
}
