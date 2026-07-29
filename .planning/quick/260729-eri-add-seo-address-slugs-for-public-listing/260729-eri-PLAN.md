---
phase: 260729-eri-add-seo-address-slugs-for-public-listing
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/0043_listings_slug.sql
  - src/lib/listings/slugify.ts
  - src/lib/listings/slugify.test.ts
  - src/lib/listings/listing-href.ts
  - src/lib/listings/listing-href.test.ts
  - src/lib/listings/reserved-slugs.ts
  - src/lib/listings/browse-utils.ts
  - src/lib/listings/browse-types.ts
  - src/lib/landing/get-featured-listings.ts
  - src/lib/landing/get-published-listings.ts
  - src/types/supabase.ts
  - src/app/actions/listings.ts
  - src/app/actions/canary.ts
  - src/components/listings/ListingDetailView.tsx
  - src/app/(public)/listings/[id]/page.tsx
  - src/app/(public)/[slug]/page.tsx
  - src/middleware.ts
autonomous: true
requirements:
  - SEO-SLUG-01
  - SEO-SLUG-02
  - SEO-SLUG-03
  - SEO-SLUG-04
  - SEO-SLUG-05
  - SEO-SLUG-06
  - SEO-SLUG-07
user_setup:
  - service: supabase
    why: "Migration 0043 must be applied to remote/local DB before slug routes resolve published listings"
    dashboard_config:
      - task: "Apply migration 0043_listings_slug.sql (supabase db push / migration up) so listings.slug exists and backfill runs"
        location: "Local: supabase db push (or project’s usual migration apply). Remote: same against production before DNS cutover."
must_haves:
  truths:
    - "Published listing at address like 151 A Signal Hill Road is reachable at /151-a-signal-hill-road for the org"
    - "Visiting /listings/{uuid} for a listing that has a slug permanently redirects to /{slug}"
    - "Public listing cards and featured links use /{slug} when slug is present, else /listings/{id}"
    - "Existing published listings receive a slug from property street_address (first comma segment) after migration/backfill"
    - "Reserved path segments (app, login, listings, …) never resolve as listing slugs"
  artifacts:
    - path: "supabase/migrations/0043_listings_slug.sql"
      provides: "listings.slug column, UNIQUE(org_id, slug), backfill from properties.street_address"
      contains: "slug"
    - path: "src/lib/listings/slugify.ts"
      provides: "slugifyAddress + allocateUniqueListingSlug helpers"
      exports: ["slugifyAddress", "allocateUniqueListingSlug"]
    - path: "src/lib/listings/listing-href.ts"
      provides: "Public href builder preferring /{slug}"
      exports: ["listingPublicHref", "isListingUuid"]
    - path: "src/components/listings/ListingDetailView.tsx"
      provides: "Shared public listing detail UI used by UUID and slug routes"
    - path: "src/app/(public)/[slug]/page.tsx"
      provides: "Root-level SEO slug page resolving published listing by org + slug"
  key_links:
    - from: "src/lib/listings/browse-utils.ts"
      to: "src/lib/listings/listing-href.ts"
      via: "mapListingRow href"
      pattern: "listingPublicHref"
    - from: "src/app/(public)/listings/[id]/page.tsx"
      to: "/{slug}"
      via: "permanentRedirect when UUID has slug"
      pattern: "permanentRedirect"
    - from: "src/app/actions/listings.ts"
      to: "listings.slug"
      via: "createListing/updateListing/toggleListingStatus set slug when publishing"
      pattern: "slug"
---

<objective>
Add SEO-friendly root address slugs for public listings (`canarypm.ca/151-a-signal-hill-road`), keep UUID `/listings/[id]` working via permanent redirects, backfill existing published rows, and update all public href builders to prefer `/{slug}`.

Purpose: Domain DNS is switching now — public listing URLs must be Squarespace-style short paths ready for canarypm.ca (D-01, D-02, D-03).
Output: Migration + slug helpers, write-path auto-slug, shared detail view, root `[slug]` route, UUID→slug redirects, slug-aware public hrefs.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@supabase/migrations/0014_create_listings.sql
@src/app/(public)/listings/[id]/page.tsx
@src/lib/listings/browse-utils.ts
@src/lib/landing/get-featured-listings.ts
@src/app/actions/listings.ts
@src/app/actions/canary.ts
@src/middleware.ts
@src/types/supabase.ts
@src/app/onboarding/actions.ts

## Locked decisions (honor exactly)
- D-01: Root-level short URLs like Squarespace: `/{slug}` (e.g. `/151-a-signal-hill-road`), not only `/listings/{slug}`
- D-02: Must work for all published property listings
- D-03: Feature must be ready for domain DNS switch (no deferred “later”)
- Out of scope: inquiry retagging (do not implement)

## Route collision reserve list (must not become listing slugs)
`app`, `login`, `signup`, `listings`, `invite`, `onboarding`, `admin`, `owner`, `my-home`, `jobs`, `portfolio`, `people`, `properties`, `leases`, `payments`, `maintenance`, `dashboard`, `settings`, `auth-code-error`, `receipts`, `api`, `vendor`, `inquiries`, `_next`

## Current patterns to follow
- Org resolution: `x-org-slug` header / `?org=` / `NEXT_PUBLIC_DEFAULT_ORG_SLUG` (default `canary`)
- Anon published read: `createPublicClient()` + `status = 'published'` + `org_id`
- Existing slugify style in `src/app/onboarding/actions.ts` (lowercase, non-alnum → `-`, trim edges) — extract/adapt into shared listing helper; do not leave a private copy only inside onboarding
- Next.js 16 App Router: read `node_modules/next/dist/docs/` if unsure about `permanentRedirect` / dynamic params (`params: Promise<...>`)

## Interfaces / contracts to implement

```typescript
// src/lib/listings/slugify.ts
export function slugifyAddress(streetAddress: string): string
// first comma segment only → "151 A Signal Hill Road, St. John's" → "151-a-signal-hill-road"
// empty/invalid → fallback "listing"

export async function allocateUniqueListingSlug(opts: {
  supabase: /* SupabaseClient */
  orgId: string
  streetAddress: string
  excludeListingId?: string
}): Promise<string>
// base = slugifyAddress; if reserved or taken in org → try base-2, base-3, ... until free
// never returns a reserved segment

// src/lib/listings/listing-href.ts
export function isListingUuid(idOrSlug: string): boolean
// UUID v4/v1 regex (case-insensitive)

export function listingPublicHref(listing: { id: string; slug?: string | null }, orgQuery: string): string
// slug present → `/${slug}${orgQuery}` else `/listings/${id}${orgQuery}`

// src/lib/listings/reserved-slugs.ts
export const RESERVED_LISTING_SLUGS: ReadonlySet<string>
export function isReservedListingSlug(slug: string): boolean
```

## Middleware note
Today `x-org-slug` is set only when `pathname.startsWith('/listings')`. Root `/{slug}` pages need the same header so org resolution matches listing detail. Treat single-segment public listing paths as public (skip auth redirects) the same way `/listings` is public — without making every unknown path public forever: set org header for all matched requests (cheap) OR for paths that are not protected; ensure `/{slug}` never hits `isProtectedPath` false-negatives (it already does not). Critical: do not redirect unauthenticated users away from `/{slug}`.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Migration, slug helpers, types, and tests</name>
  <files>supabase/migrations/0043_listings_slug.sql, src/lib/listings/slugify.ts, src/lib/listings/slugify.test.ts, src/lib/listings/listing-href.ts, src/lib/listings/listing-href.test.ts, src/lib/listings/reserved-slugs.ts, src/types/supabase.ts</files>
  <behavior>
    - slugifyAddress("151 A Signal Hill Road, St. John's, NL") → "151-a-signal-hill-road"
    - slugifyAddress("  ##  ") → "listing" (or stable non-empty fallback)
    - isReservedListingSlug("login") → true; isReservedListingSlug("151-a-signal-hill-road") → false
    - listingPublicHref({ id: "uuid", slug: "151-a-signal-hill-road" }, "?org=canary") → "/151-a-signal-hill-road?org=canary"
    - listingPublicHref({ id: "uuid", slug: null }, "?org=canary") → "/listings/uuid?org=canary"
    - isListingUuid returns true for standard UUID strings and false for address slugs
  </behavior>
  <action>
    1. Add `supabase/migrations/0043_listings_slug.sql` (per D-01/D-02):
       - `ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS slug TEXT;`
       - `CREATE UNIQUE INDEX listings_org_id_slug_key ON public.listings (org_id, slug) WHERE slug IS NOT NULL;` (or `UNIQUE (org_id, slug)` — Postgres allows multiple NULLs either way; prefer partial unique index if full UNIQUE would conflict with tooling)
       - Backfill: for every listing with `slug IS NULL`, join `units` → `properties`, take `split_part(trim(street_address), ',', 1)`, slugify in SQL (lower, regexp_replace non-alnum to `-`, trim `-`), then resolve collisions per `org_id` by appending `-2`, `-3`, …; if result is empty or in reserved set, use `listing-` || left(replace(id::text,'-',''), 8) or similar unique fallback.
       - Do not change RLS.
    2. Create `reserved-slugs.ts` with the full reserve list from context.
    3. Create `slugify.ts` with `slugifyAddress` + `allocateUniqueListingSlug` (query existing slugs for org, exclude current listing id on update). Mirror onboarding slugify rules; address uses first comma segment only.
    4. Create `listing-href.ts` with `isListingUuid` + `listingPublicHref`.
    5. Add Vitest files matching existing `src/lib/businessDays.test.ts` style covering the behaviors above (mock supabase for allocateUniqueListingSlug collision / reserved cases if tested).
    6. Update `src/types/supabase.ts` listings Row/Insert/Update to include `slug: string | null` (project does not auto-regen types via package script).
  </action>
  <verify>
    <automated>npx vitest run src/lib/listings/slugify.test.ts src/lib/listings/listing-href.test.ts</automated>
  </verify>
  <done>Migration file exists with slug column + unique org/slug + backfill SQL; helpers export and pass tests; supabase types include listings.slug.</done>
</task>

<task type="auto">
  <name>Task 2: Auto-set slug on write paths and public href builders</name>
  <files>src/app/actions/listings.ts, src/app/actions/canary.ts, src/lib/listings/browse-utils.ts, src/lib/listings/browse-types.ts, src/lib/landing/get-featured-listings.ts, src/lib/landing/get-published-listings.ts</files>
  <action>
    Per D-02 — every path that creates or publishes a listing must ensure `slug` is set from the unit’s property street address.

    1. In `createListing` / `updateListing` / `toggleListingStatus` (`src/app/actions/listings.ts`):
       - When status is `published` (or becoming published), load unit→property `street_address`, call `allocateUniqueListingSlug`, persist `slug` on insert/update.
       - On update: if already has a slug and unit/address unchanged, keep existing slug (stable URLs). If unit changes or slug is null while publishing, re-allocate.
       - When status is not published, slug may remain as-is (do not clear on unpublish — preserves redirects if re-published).
    2. In `saveDraftListing` (`src/app/actions/canary.ts`): when `status === 'published'`, set slug the same way (street_address already loaded for title). Include `slug` in insert/update/upsert payload.
    3. Extend `ListingRow` / featured select queries to include `slug`.
    4. Change `mapListingRow` and `get-featured-listings` href construction to use `listingPublicHref` (prefer `/{slug}` when present). Do not leave hardcoded `/listings/${listing.id}` in public browse/featured builders.
    5. Do not implement inquiry retagging.
  </action>
  <verify>
    <automated>npx vitest run src/lib/listings/slugify.test.ts src/lib/listings/listing-href.test.ts; rg -n "listingPublicHref|/listings/\$\{listing\.id\}" src/lib/listings/browse-utils.ts src/lib/landing/get-featured-listings.ts</automated>
  </verify>
  <done>Write paths set slug when publishing; public href builders prefer /{slug}; no leftover hardcoded /listings/${listing.id} in browse-utils or get-featured-listings.</done>
</task>

<task type="auto">
  <name>Task 3: Shared detail view, root /[slug] route, UUID redirects, middleware</name>
  <files>src/components/listings/ListingDetailView.tsx, src/app/(public)/listings/[id]/page.tsx, src/app/(public)/[slug]/page.tsx, src/middleware.ts</files>
  <action>
    Per D-01 — root-level slug pages without duplicating the large detail page.

    1. Extract the presentational body of `src/app/(public)/listings/[id]/page.tsx` into `src/components/listings/ListingDetailView.tsx` (props: listing row data already loaded + photos + similar groups + org/copy bits the page already computes). Keep data fetching in route pages.
    2. Update `/listings/[id]/page.tsx`:
       - Resolve org as today.
       - If `isListingUuid(id)`: fetch published listing by `id` + `org_id`. If found and `slug` non-null → `permanentRedirect(\`/${slug}${orgQueryIfNeeded}\`)` (preserve `?org=` when present). If found without slug → render detail (fallback). If not found → `notFound()`.
       - If `id` is not a UUID (slug-shaped): look up by `slug` + org + published; if found → `permanentRedirect(\`/${slug}\`)` (canonical root) or render via shared view — prefer redirect to root `/{slug}` for one canonical URL.
    3. Add `src/app/(public)/[slug]/page.tsx`:
       - If `isReservedListingSlug(slug)` → `notFound()`.
       - If `isListingUuid(slug)` → optional redirect to `/listings/{uuid}` handling (or fetch by id then redirect to slug) — avoid treating UUIDs as address slugs.
       - Else fetch published listing where `slug = params.slug` and `org_id = org.id`; missing → `notFound()`; hit → render `ListingDetailView`.
       - Reuse same `dynamic = 'force-dynamic'` / gallery / similar-listings behavior as the UUID page.
    4. Middleware (`src/middleware.ts`):
       - Set `x-org-slug` for public listing slug traffic the same as `/listings` (e.g. set header for all requests, or for paths that are not clearly app portals). Ensure unauthenticated access to `/{slug}` is not redirected to `/login`.
       - Do not mark protected prefixes as public.
    5. Confirm Next static routes (`/login`, `/app`, …) continue to win over `[slug]` — reserved check is defense-in-depth only.
  </action>
  <verify>
    <automated>npx vitest run src/lib/listings/slugify.test.ts src/lib/listings/listing-href.test.ts; rg -n "permanentRedirect|ListingDetailView|isReservedListingSlug" "src/app/(public)/listings/[id]/page.tsx" "src/app/(public)/[slug]/page.tsx"; rg -n "x-org-slug" src/middleware.ts</automated>
  </verify>
  <done>Shared ListingDetailView exists; root /[slug] resolves published listings; /listings/{uuid} permanentRedirects to /{slug} when slug set; reserved slugs 404; middleware supplies org slug for public SEO paths.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| anon client → listings read | Public visitors resolve listings by slug or UUID without auth |
| manager actions → listings write | Authenticated managers set slug on create/publish |
| URL path → reserved app routes | Root `[slug]` must not shadow portal/auth routes |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-260729-01 | Information Disclosure | `(public)/[slug]/page.tsx` | mitigate | Only `status = 'published'` + org-scoped queries via public client; drafts/unlisted never returned (same as listings_select_anon) |
| T-260729-02 | Tampering | slug allocation | mitigate | Slug generated server-side from street_address only; never accept client-supplied slug in forms |
| T-260729-03 | Spoofing | reserved path collision | mitigate | RESERVED_LISTING_SLUGS + Next static route precedence; reserved → notFound() |
| T-260729-04 | Elevation | createListing/updateListing | accept | Existing role checks (manager/admin) unchanged; slug write rides same guards |
| T-260729-05 | Denial of Service | allocateUniqueListingSlug loop | mitigate | Cap suffix attempts (e.g. 50) then fall back to `listing-{idprefix}` unique slug |
| T-260729-SC | Tampering | npm installs | accept | No new packages in this task |
</threat_model>

<verification>
After migration applied locally:
1. Pick a published listing with known address (e.g. 151 A Signal Hill Road) → open `http://localhost:3000/151-a-signal-hill-road` (add `?org=` if needed) → listing detail renders.
2. Open `/listings/{uuid}` for same listing → browser ends on `/{slug}` (308/permanent redirect).
3. Landing / listings browse cards link to `/{slug}` not `/listings/{uuid}` when slug present.
4. Visit a reserved path like `/login` → still login page, not listing 404/detail.
5. Unpublished/draft listing slug URL → 404.
</verification>

<success_criteria>
- `listings.slug` exists, unique per org, backfilled from street address short form
- Root `/{slug}` serves published listings for the resolved org
- `/listings/{uuid}` permanent-redirects to `/{slug}` when slug present
- All public href builders prefer `/{slug}`
- Vitest for slugify/href helpers passes
- Inquiry retagging not implemented (explicitly out of scope)
</success_criteria>

<output>
Create `.planning/quick/260729-eri-add-seo-address-slugs-for-public-listing/260729-eri-SUMMARY.md` when execution completes (orchestrator may also accept SUMMARY.md).
Do not update ROADMAP.md (quick task).
</output>
