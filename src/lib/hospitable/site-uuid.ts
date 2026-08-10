/** Canary / default Hospitable Direct Booking site UUID (`data-site-uuid`). */
export const DEFAULT_HOSPITABLE_SITE_UUID = '9f1c2015-de57-4be3-a80c-1927d81e8f41'

/**
 * Org-level site UUID for the Hospitable direct-booking widget loader.
 * Override with env `HOSPITABLE_SITE_UUID` (server); falls back to Canary's site.
 */
export function getHospitableSiteUuid(): string {
  return process.env.HOSPITABLE_SITE_UUID?.trim() || DEFAULT_HOSPITABLE_SITE_UUID
}
