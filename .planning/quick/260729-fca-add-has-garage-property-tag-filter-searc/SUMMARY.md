---
phase: 260729-fca-add-has-garage-property-tag-filter-searc
plan: 01
subsystem: listings
tags: [garage, amenities, browse-filters, canary, vitest]

requires: []
provides:
  - Exported hasGarage(\bgarage\b) detection on amenities/description
  - BrowseFilters.garage + BrowseListing.hasGarage + public filter/NL search
  - CanaryProperty.hasGarage tagging via units.amenities "Garage" + matchProp/pill
affects: [public-listings, canary-properties, tenant-matching]

tech-stack:
  added: []
  patterns:
    - "Amenity tag Garage on units.amenities (TEXT[]) — no DB migration (pets/Parking pattern)"
    - "Public filter + landing NL use same \\bgarage\\b detection as mapListingRow"
    - "Canary matchProp strips garage token then address-matches remainder"

key-files:
  created:
    - src/lib/listings/browse-utils.test.ts
  modified:
    - src/lib/listings/browse-types.ts
    - src/lib/listings/browse-utils.ts
    - src/lib/canary/types.ts
    - src/lib/canary/load-db.ts
    - src/components/properties/AddUnitForm.tsx
    - src/app/actions/entity-updates.ts
    - src/components/canary/EntityDetailDrawer.tsx
    - src/components/canary/PropertyOccupancyCalendar.tsx
    - src/components/listings/ListingsFilterBar.tsx
    - src/components/landing/LandingHomesBrowse.tsx
    - src/components/landing/landing-page.tsx
    - src/components/canary/CanaryApp.tsx

key-decisions:
  - "D-01: Store as amenity tag Garage on units.amenities — no migration"
  - "D-02: Public filter toggle + NL garage in landing search"
  - "D-03: Canary tag + search/filter for tenant matching"
  - "D-04: Detect with case-insensitive \\bgarage\\b"
  - "entity-updates uses typed UnitUpdate amenities array (not Record<string, unknown>)"

patterns-established:
  - "hasGarage exported from browse-utils; load-db imports it for CanaryProperty"
  - "Garage amenity rewrite composes after pets rewrite in updatePropertyDetails"

requirements-completed: [GARAGE-01, GARAGE-02, GARAGE-03, GARAGE-04, GARAGE-05, GARAGE-06]

duration: 4min
completed: 2026-07-29
---

# Phase 260729-fca: Add Has Garage Property Tag Filter Search Summary

**Managers tag `"Garage"` on `units.amenities`; public browse/NL search and Canary property search/filter use shared `\bgarage\b` `hasGarage` detection (no migration).**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-29T11:06:31Z
- **Completed:** 2026-07-29T11:10:07Z
- **Tasks:** 3/3
- **Files modified:** 13

## Accomplishments
- Exported `hasGarage` with Vitest coverage (amenities, description, word boundary, case)
- Add Unit + Canary property edit persist literal `"Garage"` on amenities; detail/calendar show Yes/No
- Public Garage filter toggle, landing NL search, Canary `matchProp` + Garage pill for tenant matching

## Task Commits

1. **Task 1: hasGarage detection, browse/canary types, Vitest** - `f55ce0b` (test) → `144f26b` (feat)
2. **Task 2: Tag Garage on units (AddUnitForm + Canary edit)** - `2aa80d3` (feat)
3. **Task 3: Public Garage filter + landing NL + Canary search/pill** - `8662ace` (feat)

## Files Created/Modified
- `src/lib/listings/browse-utils.test.ts` - Vitest for hasGarage / parseBrowseFilters / filterListings
- `src/lib/listings/browse-types.ts` - garage search param, filter boolean, hasGarage on listing
- `src/lib/listings/browse-utils.ts` - hasGarage export + wiring
- `src/lib/canary/types.ts` / `load-db.ts` - CanaryProperty.hasGarage from amenities
- `src/components/properties/AddUnitForm.tsx` - Garage amenity option
- `src/app/actions/entity-updates.ts` - hasGarage boolean → amenities rewrite (typed UnitUpdate)
- `src/components/canary/EntityDetailDrawer.tsx` / `PropertyOccupancyCalendar.tsx` - Garage controls + read view
- `src/components/listings/ListingsFilterBar.tsx` - Garage toggle after pets
- `src/components/landing/LandingHomesBrowse.tsx` / `landing-page.tsx` - default filter + NL
- `src/components/canary/CanaryApp.tsx` - matchProp + Garage pill + timeline base filter

## Decisions Made
Followed locked D-01–D-04 exactly. Inquiry retagging intentionally not implemented.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] askEntityHits + timeline respect garage**
- **Found during:** Task 3
- **Issue:** Global search property hits used raw address includes only; timeline would ignore Garage pill
- **Fix:** askEntityHits uses `matchProp`; timeline base also applies `garageFilter`
- **Files modified:** `src/components/canary/CanaryApp.tsx`
- **Verification:** rg + tsc --noEmit
- **Committed in:** `8662ace`

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Improves tenant-matching consistency; no scope creep beyond D-03.

## Issues Encountered
None

## User Setup Required
None — no new env vars or migrations.

## Known Stubs
None

## Threat Flags
None — no new endpoints; amenities rewritten server-side to literal `"Garage"` / strip via Zod boolean (T-260729-fca-01 mitigated as planned).

## TDD Gate Compliance
- RED: `f55ce0b` test(260729-fca-01) — 10 failing tests
- GREEN: `144f26b` feat(260729-fca-01) — 10 passing

## Verification Results

### Automated
- `npx vitest run src/lib/listings/browse-utils.test.ts` — **10/10 passed**
- `npx tsc --noEmit` — **passed** (typed UnitUpdate amenities; no Record&lt;string, unknown&gt;)
- rg verifies Garage/hasGarage wiring in Task 2/3 files

### Manual (deferred to human)
1. Tag unit with Garage → reload Canary → hasGarage Yes
2. Public homes browse → Garage toggle
3. Landing search `2 bed with garage`
4. Canary Properties search `garage` / Garage pill

## Self-Check: PASSED

- FOUND: `src/lib/listings/browse-utils.test.ts`
- FOUND: `src/lib/listings/browse-utils.ts` (`hasGarage` export)
- FOUND: commits `f55ce0b`, `144f26b`, `2aa80d3`, `8662ace`
