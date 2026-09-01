# Property Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not commit unless the user asked.

**Goal:** Staff can resume unfinished property setup from a dashboard card and a listings pin, with an Airbnb-style wizard that saves real rows as they go.

**Architecture:** `property_onboarding` stores path + current step + details-confirmed time. Completeness is derived in `src/lib/canary/property-onboarding.ts`. The wizard lives in CanaryApp as view `property-setup` and writes through existing server actions plus a thin onboarding action layer.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), React 19 client components, incumbent Canary CSS tokens, Vitest.

## Global Constraints

- Staff dashboard only. Do not restyle existing pages, swap fonts, change tokens, or add an animation library.
- Owner/portfolio remain optional on create; owner is required to **complete** onboarding.
- `prefers-reduced-motion` respected. Keyboard focus visible.
- Writes: manager/admin. Queue visibility: staff (manager, admin, employee).
- User did not ask for git commits; skip commit steps.

## File map

- Create: `supabase/migrations/0061_property_onboarding.sql`
- Create: `src/lib/canary/property-onboarding.ts`
- Create: `src/lib/canary/property-onboarding.test.ts`
- Create: `src/app/actions/property-onboarding.ts`
- Create: `src/components/canary/PropertySetupWizard.tsx`
- Create: `src/components/canary/NeedsSetupCard.tsx`
- Modify: `src/lib/canary/types.ts` — `CanaryOnboarding`, `CanaryDb.onboardings`
- Modify: `src/lib/canary/load-db.ts` — load onboardings
- Modify: `src/lib/canary/current-listings-groups.ts` — pin incomplete vacant drafts
- Modify: `src/app/actions/properties.ts` — insert onboarding row, return ids
- Modify: `src/components/canary/CanaryAddPropertyModal.tsx` — open wizard
- Modify: `src/components/canary/CanaryApp.tsx` — card, view, badge, URL
- Modify: `src/components/canary/canary.css` — wizard + card only
- Modify: `src/types/supabase.ts` — regenerate or hand-add table types

---

### Task 1: Completeness helper (TDD)

**Files:**
- Create: `src/lib/canary/property-onboarding.ts`
- Test: `src/lib/canary/property-onboarding.test.ts`

**Produces:**
- `OnboardingPath`, `OnboardingStep`
- `OnboardingSnapshot`
- `missingMustHaves(snapshot) => MissingMustHave[]`
- `isOnboardingComplete(snapshot) => boolean`
- `stepsForPath(path) => OnboardingStep[]`
- `inNeedsSetupQueue(snapshot) => boolean` — false if archived or completed

- [ ] Write tests then implement until they pass: `npx vitest run src/lib/canary/property-onboarding.test.ts`

---

### Task 2: Migration + load

**Files:**
- Create: `supabase/migrations/0061_property_onboarding.sql`
- Modify: types, `load-db.ts`, `CanaryDb`

Backfill IDs:
- `f9ae7804-a859-4c38-ad02-ba81d01a5ae0` (18 A Smith Ave)
- `25067f8c-5be5-465b-a7c5-8a7828f4f812` (92 Barnes Rd)
- `f3a79385-3b11-4b93-a8dc-7add4ca0f49e` (92 A Barnes Rd)

Apply with Supabase MCP `apply_migration` on project `mdzegkaymdsmgspdgkko`.

---

### Task 3: Server actions

**Files:**
- Create: `src/app/actions/property-onboarding.ts`
- Modify: `src/app/actions/properties.ts`

- `ensureOnboarding(propertyId)` upsert
- `saveOnboardingPath`, `saveOnboardingDetails`, `saveOnboardingStep`, `recomputeOnboardingCompletion`
- `createOnboardingContact({ role: 'owner' | 'tenant', name, email, phone })`
- `createProperty` inserts onboarding row and returns `{ success: true, propertyId, unitId }`

---

### Task 4: Wizard + dashboard card + pins

**Files:**
- Create wizard + Needs setup card
- Modify CanaryApp, AddPropertyModal, current-listings-groups, canary.css

Reuse `PropertyPhotoUpload` (listing only), `SearchableSelect`, `updatePropertyDetails`, `saveDraftListing`, `createLease`, `savePropertyKnowledge` / listing_brief.

---

### Task 5: Verify

- Vitest for helper + pin sort
- Browser: dashboard card, open wizard, save & exit, resume
- Playwright screenshots 390 / 768 / 1440 of dashboard with the card and of the wizard
