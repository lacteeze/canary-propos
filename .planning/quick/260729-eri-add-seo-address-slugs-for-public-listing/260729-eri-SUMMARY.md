---
phase: 260729-eri-add-seo-address-slugs-for-public-listing
plan: 01
subsystem: listings
tags: [seo, slugs, nextjs, supabase, public-listings]

requires: []
provides:
  - listings.slug column with org-unique index and address backfill
  - Root /{slug} public listing URLs with UUID permanentRedirect
  - listingPublicHref preferring /{slug} for cards/featured
affects: [public-listings, domain-dns-cutover]

tech-stack:
  added: []
  patterns:
    - "SEO listing URLs at root /{slug}; UUID /listings/[id] permanentRedirects when slug set"
    - "allocateUniqueListingSlug server-side from street_address; never accept client slug"
    - "RESERVED_LISTING_SLUGS defense-in-depth + Next static route precedence"

key-files:
  created:
    - supabase/migrations/0043_listings_slug.sql
    - src/lib/listings/slugify.ts
    - src/lib/listings/listing-href.ts
    - src/lib/listings/reserved-slugs.ts
    - src/components/listings/ListingDetailView.tsx
    - src/app/(public)/[slug]/page.tsx
  modified:
    - src/app/actions/listings.ts
    - src/app/actions/canary.ts
    - src/lib/listings/browse-utils.ts
    - src/lib/landing/get-featured-listings.ts
    - src/lib/landing/get-published-listings.ts
    - src/app/(public)/listings/[id]/page.tsx
    - src/middleware.ts
    - src/types/supabase.ts
    - vitest.config.ts

key-decisions:
  - "D-01: Root /{slug} URLs (not /listings/{slug} only)"
  - "Middleware sets x-org-slug on all matched requests so /{slug} resolves org without marking all single-segment paths as public"
  - "Stable slugs: keep existing slug on publish unless unit changes or slug was null"

patterns-established:
  - "Public hrefs via listingPublicHref({ id, slug }, orgQuery)"
  - "Shared ListingDetailView for UUID and slug route pages"

requirements-completed: [SEO-SLUG-01, SEO-SLUG-02, SEO-SLUG-03, SEO-SLUG-04, SEO-SLUG-05, SEO-SLUG-06, SEO-SLUG-07]

duration: 15min
completed: 2026-07-29
---

# Phase 260729-eri: Add SEO Address Slugs for Public Listings Summary

**Root `/{slug}` public listing URLs (e.g. `/151-a-signal-hill-road`) with UUID permanent redirects, DB backfill, and slug-aware public hrefs**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-29T13:11:21Z
- **Completed:** 2026-07-29T13:30:00Z
- **Tasks:** 3/3
- **Files modified:** 17

## Accomplishments
- Added `listings.slug` with partial unique index `(org_id, slug)` and SQL backfill from property street address
- Write paths allocate unique address slugs when publishing; public browse/featured hrefs prefer `/{slug}`
- Shared `ListingDetailView`; root `[slug]` route; `/listings/{uuid}` → `permanentRedirect(/{slug})`; reserved segments 404

## Task Commits

1. **Task 1: Migration, slug helpers, types, and tests** - `ede6a68` (test)
2. **Task 2: Auto-set slug on write paths and public href builders** - `18ac63f` (feat)
3. **Task 3: Shared detail view, root /[slug] route, UUID redirects, middleware** - `6f9f5bb` (feat)

## Files Created/Modified
- `supabase/migrations/0043_listings_slug.sql` - Column, unique index, backfill
- `src/lib/listings/slugify.ts` / `.test.ts` - slugifyAddress + allocateUniqueListingSlug
- `src/lib/listings/listing-href.ts` / `.test.ts` - listingPublicHref + isListingUuid
- `src/lib/listings/reserved-slugs.ts` - RESERVED_LISTING_SLUGS
- `src/components/listings/ListingDetailView.tsx` - Shared public detail UI
- `src/app/(public)/[slug]/page.tsx` - Root SEO slug page
- `src/app/(public)/listings/[id]/page.tsx` - UUID path with permanentRedirect
- `src/app/actions/listings.ts` / `canary.ts` - Slug on publish
- `src/lib/listings/browse-utils.ts` / landing getters - Slug in selects + hrefs
- `src/middleware.ts` - x-org-slug on all requests
- `src/types/supabase.ts` - listings.slug types
- `vitest.config.ts` - Include `src/**/*.test.ts`

## Decisions Made
- Honored locked D-01/D-02/D-03: root `/{slug}`, all published listings, DNS-ready
- Did not implement inquiry retagging (out of scope)
- Middleware: set `x-org-slug` globally rather than treating every single-segment path as public (would have skipped auth for `/app`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest include path excluded co-located src tests**
- **Found during:** Task 1
- **Issue:** `vitest.config.ts` only included `tests/**`, so plan verify command found no tests
- **Fix:** Added `src/**/*.{test,spec}.{ts,tsx}` to include
- **Files modified:** `vitest.config.ts`
- **Verification:** 12 tests pass
- **Committed in:** `ede6a68`

**2. [Rule 1 - Bug] Avoid marking all single-segment paths as public in middleware**
- **Found during:** Task 3
- **Issue:** Early draft treated every `/{segment}` as public listing traffic, which would skip auth guards for `/app`
- **Fix:** Always set `x-org-slug`; keep public early-return only for `/listings`; root slugs remain public because they are not `isProtectedPath`
- **Files modified:** `src/middleware.ts`
- **Verification:** Manual review of middleware control flow
- **Committed in:** `6f9f5bb`

**3. [TDD] Combined RED+GREEN into one Task 1 commit**
- **Found during:** Task 1
- **Issue:** Helpers implemented with tests in one pass rather than separate failing-test then feat commits
- **Fix:** Single `test(...)` commit containing migration + helpers + passing tests
- **Impact:** Minor process deviation; behavior verified

---

**Total deviations:** 3 (2 auto-fixed, 1 process)
**Impact on plan:** Necessary for test runner and auth safety. No scope creep.

## Issues Encountered
None blocking. Remote migration applied successfully to Supabase project `mdzegkaymdsmgspdgkko` (pm_saas).

## Migration / Remote Status
- **Repo file:** `supabase/migrations/0043_listings_slug.sql`
- **Remote apply:** YES — via Supabase MCP `apply_migration` on `mdzegkaymdsmgspdgkko`
- **Backfill sample:** published rows have slugs (e.g. `10-golf-ave`, `12-pennywell-rd`, `18-a-wood-st`)

## User Setup Required
None further if remote migration already applied. Local stacks still need `supabase db push` / migration up if using a separate local DB.

## Test Results
```
npx vitest run src/lib/listings/slugify.test.ts src/lib/listings/listing-href.test.ts
→ Test Files  2 passed (2)
→ Tests  12 passed (12)
```

## Known Stubs
None — slug routes and hrefs are wired to published listing data.

## Threat Flags
None beyond plan threat model (published-only reads, server-side slug allocation, reserved slug 404).

## Next Phase Readiness
- Manual browser verify on localhost/prod after deploy: `/{slug}`, UUID redirect, reserved `/login`, draft 404
- DNS cutover can use root address paths

## Self-Check: PASSED
- FOUND: supabase/migrations/0043_listings_slug.sql
- FOUND: src/lib/listings/slugify.ts
- FOUND: src/lib/listings/listing-href.ts
- FOUND: src/components/listings/ListingDetailView.tsx
- FOUND: src/app/(public)/[slug]/page.tsx
- FOUND: commits ede6a68, 18ac63f, 6f9f5bb

---
*Phase: 260729-eri-add-seo-address-slugs-for-public-listing*
*Completed: 2026-07-29*
