---
phase: 260729-fca-add-has-garage-property-tag-filter-searc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/listings/browse-types.ts
  - src/lib/listings/browse-utils.ts
  - src/lib/listings/browse-utils.test.ts
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
autonomous: true
requirements:
  - GARAGE-01
  - GARAGE-02
  - GARAGE-03
  - GARAGE-04
  - GARAGE-05
  - GARAGE-06
must_haves:
  truths:
    - "Managers can tag a unit with amenity Garage via Add Unit and Canary property edit (no new DB column)"
    - "Public browse filter Garage shows only listings whose amenities/description match \\bgarage\\b"
    - "Landing hero search query containing garage filters to garage listings (same detection)"
    - "Canary properties search/filter surfaces units with hasGarage for tenant matching"
    - "Vitest covers hasGarage detection and filterListings garage filter"
  artifacts:
    - path: "src/lib/listings/browse-utils.ts"
      provides: "Exported hasGarage detection + filterListings garage boolean"
      exports: ["hasGarage", "filterListings", "parseBrowseFilters", "mapListingRow"]
    - path: "src/lib/listings/browse-utils.test.ts"
      provides: "Vitest for hasGarage + filterListings garage"
    - path: "src/components/listings/ListingsFilterBar.tsx"
      provides: "Garage filter toggle beside Pet friendly"
    - path: "src/components/canary/CanaryApp.tsx"
      provides: "matchProp garage awareness + Garage filter pill"
    - path: "src/app/actions/entity-updates.ts"
      provides: "hasGarage boolean persists Garage amenity on units.amenities"
  key_links:
    - from: "src/lib/listings/browse-utils.ts"
      to: "BrowseListing.hasGarage"
      via: "mapListingRow + filterListings"
      pattern: "hasGarage|filters\\.garage"
    - from: "src/app/actions/entity-updates.ts"
      to: "units.amenities"
      via: "updatePropertyDetails adds/removes Garage tag"
      pattern: "Garage|hasGarage"
    - from: "src/components/canary/CanaryApp.tsx"
      to: "CanaryProperty.hasGarage"
      via: "matchProp / garage filter pill"
      pattern: "hasGarage|Garage"
---

<objective>
Add a `Garage` amenity tag on `units.amenities` (TEXT[], no migration), derive `hasGarage` for public listings and Canary properties, and enable garage filter/search on the public listing UI and Canary backend property search for tenant matching.

Purpose: Managers tag garage once; public seekers and staff can filter/search by garage the same way pets already work (D-01–D-04).
Output: Detection + types, tagging UI + entity-updates, public filter/NL search, Canary matchProp/pill, Vitest. No inquiry retagging.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@src/lib/listings/browse-types.ts
@src/lib/listings/browse-utils.ts
@src/components/listings/ListingsFilterBar.tsx
@src/components/landing/LandingHomesBrowse.tsx
@src/components/landing/landing-page.tsx
@src/components/properties/AddUnitForm.tsx
@src/app/actions/entity-updates.ts
@src/lib/canary/types.ts
@src/lib/canary/load-db.ts
@src/components/canary/CanaryApp.tsx
@src/components/canary/EntityDetailDrawer.tsx
@src/components/canary/PropertyOccupancyCalendar.tsx
@src/lib/listings/slugify.test.ts

## Locked decisions (honor exactly)
- D-01: Store as amenity tag `"Garage"` on `units.amenities` (TEXT[]) — no new DB column/migration (matches pets/Parking pattern)
- D-02: Public: filter toggle on listings filter bar + natural-language `garage` in landing search bar
- D-03: Backend Canary app: managers can tag garage on property/unit, and search/filter properties that have a garage for tenant matching
- D-04: Detect with case-insensitive `\bgarage\b` on amenities (and optionally description)
- Out of scope: inquiry retagging — do not implement

## Pattern to copy (pets)
- Public: private `isPetFriendly` regex → `BrowseListing.petFriendly` in `mapListingRow` → `filters.pets` boolean in `BrowseFilters` / `parseBrowseFilters` (`pets=1|true`) → `filterListings` gate → `ListingsFilterBar` toggle → `LandingHomesBrowse` DEFAULT_FILTERS → `landing-page.tsx` `matchListings` NL `\bpet|dog|cat\b`
- Tagging: `AddUnitForm` `AMENITY_OPTIONS`; Canary edit via `entity-updates.ts` `PET_AMENITY_RE` rewriting `units.amenities`; `EntityDetailDrawer` / `PropertyOccupancyCalendar` pets select
- Canary load: `petsLabel` in `load-db.ts` → `CanaryProperty.petFriendly`; `matchProp` today is address-only (`CanaryApp.tsx` ~705)

## Contracts to implement

```typescript
// browse-utils.ts — export for Vitest + reuse
export function hasGarage(amenities: string[] | null, description?: string | null): boolean
// true iff /\bgarage\b/i matches joined amenities (+ optional description)

// browse-types.ts
BrowseSearchParams.garage?: string
BrowseFilters.garage: boolean   // parse like pets: '1' | 'true'
BrowseListing.hasGarage: boolean

// canary/types.ts
CanaryProperty.hasGarage: boolean

// entity-updates PropertyDetailsInput
hasGarage: z.boolean()
// persist: add literal "Garage" to amenities when true; remove amenities matching /\bgarage\b/i when false
// compose after pets amenity rewrite so both can save in one request
```
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: hasGarage detection, browse/canary types, Vitest</name>
  <files>src/lib/listings/browse-types.ts, src/lib/listings/browse-utils.ts, src/lib/listings/browse-utils.test.ts, src/lib/canary/types.ts, src/lib/canary/load-db.ts</files>
  <behavior>
    - hasGarage(["Garage"], null) → true
    - hasGarage(["Parking", "Laundry"], null) → false
    - hasGarage(["parking garage"], null) → true (word boundary on garage)
    - hasGarage(["garages"], null) → false (no bare garage token) — if JS \b treats this as no match; assert actual \bgarage\b semantics
    - hasGarage([], "Unit includes a garage.") → true (optional description)
    - hasGarage(["GARAGE"], null) → true (case-insensitive)
    - filterListings with filters.garage true keeps only listings with hasGarage true
    - parseBrowseFilters({ garage: "1" }).garage === true; missing/empty → false
  </behavior>
  <action>
    Per D-01/D-04 — no migration.

    1. Add `garage?: string` to `BrowseSearchParams`, `garage: boolean` to `BrowseFilters`, `hasGarage: boolean` to `BrowseListing` in `browse-types.ts`.
    2. In `browse-utils.ts`: export `hasGarage(amenities, description?)` using case-insensitive `\bgarage\b` on joined amenities + optional description (mirror pets text join). Wire `parseBrowseFilters` (`garage === '1' || garage === 'true'`), set `hasGarage` in `mapListingRow`, and gate `filterListings` with `if (filters.garage && !listing.hasGarage) return false`. Optionally push a short Garage tag into `tags` when true (discretion — keep tag budget; pets already take a slot).
    3. Add `hasGarage: boolean` to `CanaryProperty` in `types.ts`. In `load-db.ts` property mapping (~338), set `hasGarage: hasGarage(u.amenities, null)` — either import exported `hasGarage` from browse-utils or duplicate the same `\bgarage\b` regex locally (pets currently duplicates; prefer import if it avoids circular deps; load-db → browse-utils is fine).
    4. Create `src/lib/listings/browse-utils.test.ts` (Vitest, same style as `slugify.test.ts`) covering the behaviors above. Export enough surface that tests do not poke private helpers.
  </action>
  <verify>
    <automated>npx vitest run src/lib/listings/browse-utils.test.ts</automated>
  </verify>
  <done>hasGarage exported and tested; BrowseListing/Filters/SearchParams include garage; mapListingRow + filterListings + parseBrowseFilters wired; CanaryProperty.hasGarage set from amenities in load-db.</done>
</task>

<task type="auto">
  <name>Task 2: Tag Garage on units (AddUnitForm + Canary edit)</name>
  <files>src/components/properties/AddUnitForm.tsx, src/app/actions/entity-updates.ts, src/components/canary/EntityDetailDrawer.tsx, src/components/canary/PropertyOccupancyCalendar.tsx</files>
  <action>
    Per D-01/D-03 — store literal amenity `"Garage"` on `units.amenities`; no new column.

    1. `AddUnitForm.tsx`: add `{ value: 'Garage', label: 'Garage' }` to `AMENITY_OPTIONS` (alongside Parking/Laundry/etc.). Existing toggleAmenity + createUnit path already persists the array.
    2. `entity-updates.ts`: extend `propertyDetailsSchema` with `hasGarage: z.boolean()`. After the existing pets amenity rewrite, apply garage: start from `unitPatch.amenities ?? current amenities`; strip entries matching `/\bgarage\b/i`; if `form.hasGarage`, append `"Garage"` if missing; if clearing and strip changed length, write stripped list. Push a `changes` audit entry for field `garage` when the effective hasGarage flips. Do not touch inquiry retagging.
    3. `EntityDetailDrawer.tsx` PropertyEditForm: local `hasGarage` state from `property.hasGarage`; checkbox or Yes/No control labeled Garage near Pets; include `hasGarage` in `PropertyDetailsInput` payload. Read-only property rows: show Garage Yes/No (or amenity presence) next to Pets.
    4. `PropertyOccupancyCalendar.tsx` quick edit: same `hasGarage` state + control + payload; read view shows Garage.
  </action>
  <verify>
    <automated>rg -n "Garage|hasGarage" src/components/properties/AddUnitForm.tsx src/app/actions/entity-updates.ts src/components/canary/EntityDetailDrawer.tsx src/components/canary/PropertyOccupancyCalendar.tsx</automated>
  </verify>
  <done>Managers can add Garage via Add Unit amenities and toggle Garage on Canary property edit forms; updatePropertyDetails persists "Garage" on units.amenities; detail/calendar show garage state.</done>
</task>

<task type="auto">
  <name>Task 3: Public Garage filter + landing NL + Canary search/pill</name>
  <files>src/components/listings/ListingsFilterBar.tsx, src/components/landing/LandingHomesBrowse.tsx, src/components/landing/landing-page.tsx, src/components/canary/CanaryApp.tsx</files>
  <action>
    Per D-02/D-03.

    1. `ListingsFilterBar.tsx`: add a Garage toggle button immediately after the Pet friendly toggle, same accent styling pattern, calling `onFiltersChange({ garage: !filters.garage })`. Label: `Garage` (no emoji required; keep visual weight similar to pets).
    2. `LandingHomesBrowse.tsx`: set `garage: false` on `DEFAULT_FILTERS` so types compile and filterListings receives the field.
    3. `landing-page.tsx` `matchListings`: detect `wantsGarage = /\bgarage\b/i.test(q)`; when true require `listing.hasGarage`; strip garage tokens from the free-text remainder the same way pets are stripped so address search is not polluted.
    4. `CanaryApp.tsx`:
       - Extend `matchProp` so search query matching `\bgarage\b` also matches properties with `p.hasGarage` (keep address substring match). Example: q empty → all; q `garage` → garage units; q address fragment → address; both can combine sensibly (if q contains garage word AND other text, require hasGarage AND address contains remaining text — keep logic simple and documented in a one-line comment).
       - Add a Garage filter pill on the properties toolbar (near status pills): when active, further restrict `filteredProps` / leasing `base` lists to `p.hasGarage`. Use local state e.g. `garageFilter` boolean; pill shows active styling like `cy-pill--active`. Count optional.
       - Ensure both properties page list and any tenant-matching property pickers that use `matchProp` benefit (leasing draft property pick uses `activeProps.filter(matchProp)` ~869).
  </action>
  <verify>
    <automated>npx vitest run src/lib/listings/browse-utils.test.ts; rg -n "garage|hasGarage|Garage" src/components/listings/ListingsFilterBar.tsx src/components/landing/LandingHomesBrowse.tsx src/components/landing/landing-page.tsx src/components/canary/CanaryApp.tsx</automated>
  </verify>
  <done>Public filter bar Garage toggle works via filterListings; landing NL garage filters results; Canary matchProp + Garage pill filter properties with hasGarage for tenant matching.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| public anon → browse filters | Untrusted query/filter params only narrow published listing client data |
| manager UI → updatePropertyDetails | Authenticated staff mutate units.amenities |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-260729-fca-01 | Tampering | entity-updates hasGarage | mitigate | Zod boolean + staff-only getStaffContext; amenities rewritten server-side to literal "Garage" / strip, never trust free-form client amenity arrays from this form |
| T-260729-fca-02 | Information Disclosure | public hasGarage | accept | Only derived from already-public published listing amenities/description; no new PII |
| T-260729-fca-03 | Elevation | AddUnitForm / Canary edit | accept | Existing createUnit / updatePropertyDetails auth unchanged |
| T-260729-fca-SC | Tampering | npm installs | accept | No new packages |
</threat_model>

<verification>
1. Add/edit a unit with Garage amenity → reload Canary property → hasGarage true / Garage shown.
2. Public landing homes browse → toggle Garage → only garage listings remain.
3. Landing hero search `2 bed with garage` → results require hasGarage (and beds if parsed).
4. Canary Properties: type `garage` in search and/or activate Garage pill → only garage units; usable when matching a tenant to a property.
5. `npx vitest run src/lib/listings/browse-utils.test.ts` passes.
6. No inquiry retagging code added.
</verification>

<success_criteria>
- `"Garage"` stored on `units.amenities` only (no migration/column)
- Public filter + landing NL garage search work via `\bgarage\b` detection
- Canary tagging + matchProp/Garage pill support tenant matching
- Vitest covers hasGarage + filterListings garage
- Inquiry retagging not implemented
</success_criteria>

<output>
Create `.planning/quick/260729-fca-add-has-garage-property-tag-filter-searc/260729-fca-SUMMARY.md` when execution completes.
Do not update ROADMAP.md (quick task).
</output>
