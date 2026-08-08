// Shared Storage upload Cache-Control for org-assets.
// Paths are content-addressed (timestamp / unique name), so long TTL is safe
// and maximizes CDN / browser cached-egress savings on repeat views.

/** One year — preferred for immutable uploads (photos, logos, avatars, PDFs). */
export const STORAGE_CACHE_CONTROL_IMMUTABLE = '31536000'
