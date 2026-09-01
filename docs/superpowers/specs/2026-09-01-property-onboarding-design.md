# Property onboarding (Airbnb-style setup)

**Date:** 2026-09-01  
**Status:** Approved  
**Product:** Canary PropOS — staff dashboard  
**Surface:** Staff app (`/app`) — Impeccable PRODUCT / Operate. Incumbent tokens, fonts, and shadcn stay.

## Problem

New properties can be created with only an address. They vanish from daily work unless someone remembers to open them. Staff need a saved, resumable setup flow (listing **or** existing tenancy) that stays pinned until the must-haves are done — for the person who started it and for the rest of the team.

## Who it is for

Property managers on desktop, all day. Same org queue for manager / admin / employee (employees can see; writes stay manager/admin, matching existing property/listing actions).

## Decisions (locked)

1. One flow. First step chooses **Vacant** (listing + photos + details) or **Occupied** (lease + tenant + details).
2. Auto-drop from the queue when must-haves are true. Staff do not click a separate Ready.
3. Full-page wizard. Continue writes real rows. Save & exit keeps progress. Resume at `current_step`.
4. Persist a `property_onboarding` row (path + last step + details-confirmed timestamp). Completeness is derived from live data plus that timestamp.
5. Do **not** backfill the whole portfolio. New creates start a row. One-time backfill: 18 A Smith Ave, 92 Barnes Rd, 92 A Barnes Rd.

## Must-haves (all required to complete)

- Path chosen (`vacant` | `occupied`)
- Details step saved (`details_completed_at`) — factory default 1 bed / 1 bath does **not** count
- `properties.owner_id` set
- At least one **listing** photo (`property_media.visibility = 'listing'`)
- Vacant: a `listings` row exists (status `draft` is enough)
- Occupied: a `leases` row exists **and** that lease has a `tenant_id`

When these are true, set `completed_at` and hide the property from Needs setup. Vacant listing drafts unpin from the top of Current Listings Drafts.

## Data

Table `property_onboarding`:

| Column | Notes |
|---|---|
| `id` | uuid pk |
| `org_id` | fk organizations, cascade |
| `property_id` | fk properties, unique, cascade |
| `path` | `vacant` \| `occupied` \| null |
| `current_step` | `path` \| `details` \| `photos` \| `listing` \| `lease` |
| `details_completed_at` | timestamptz, null until details step saved |
| `completed_at` | timestamptz, set automatically |
| `created_by` | fk people, on delete set null |
| `created_at` / `updated_at` | |

RLS: staff SELECT in org; manager/admin INSERT/UPDATE/DELETE in org. Same helper wrapping as other tables (`(SELECT public.org_id())`, `(SELECT public.user_role())`).

Wizard writes existing tables: `properties`, `units`, `listing_brief`, `property_media`, `listings`, `leases`, `people`.

## Surfaces

1. **Dashboard — Needs setup** card, above Current Listings. Hidden when empty. Row: address, path (or “Path not chosen”), missing chips, creator, last saved. Click opens wizard at `current_step`.
2. **Current Listings → Drafts:** vacant-path incomplete listings pinned to the **top** of Drafts. Occupied path never creates a listing draft and never appears here.
3. **Properties list:** newest-first already. Unfinished rows get a small **Setup** badge that opens the wizard.

After FAB Add property: create property + vacant unit + onboarding row, then open the wizard (not only the Properties list).

## Wizard

Staff chrome, left step rail, one step in the main pane. No new fonts, no animation library, `prefers-reduced-motion` respected.

Shared: **Path** → **Details** → **Photos** → then **Listing** (vacant) or **Lease & tenant** (occupied).

- Details: owner (search + add), portfolio optional, type, beds, baths, parking / pets / utilities (`listing_brief`), asking rent, management fee. Saving sets `details_completed_at`.
- Photos: reuse listing-photo upload (`PropertyPhotoUpload`, listing visibility).
- Listing: title, rent, available date, description; `saveDraftListing` as draft. Publish optional.
- Lease: tenant search + add, start, end, rent, deposit; `createLease`.

Save & exit and closing persist `current_step`. Rail: done / current / not started. Jump to any reached step. Cannot complete by skipping must-haves.

## Edge cases

- Switch vacant ↔ occupied until a listing **or** lease exists. After that, confirm. Vacant→occupied keeps the listing draft. Occupied→vacant keeps the lease and can start a listing draft.
- Add owner / add tenant inline (name, email, phone). No dead-end to People.
- Concurrent editors: last write wins; re-open loads live data.
- Failed upload/save stays on that step; earlier steps remain saved.
- Archive or delete property removes it from Needs setup.
- After complete, later edits use the normal property / listing screens.

## Out of scope

- Restyling Current Listings, Properties, or tokens
- Public `/onboard` intake form
- Owner portal / tenant portal
- Forcing the existing portfolio into the queue
- Auto-publish listings
- Animation libraries

## Testing

- Pure completeness helper: missing chips, factory beds/baths, vacant vs occupied, archived/completed filtered out
- Pin sort: incomplete vacant drafts before other drafts
- `createProperty` inserts an onboarding row
- RLS: staff read, manager write
