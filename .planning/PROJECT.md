# Canary PropOS

## What This Is

A full-stack, multi-tenant property management platform built first for Canary Property Management (150+ units) and sold as SaaS to other managers and independent landlords. It connects properties, owners, tenants, vendors, leases, maintenance, payments, and documents — with role-appropriate portals for everyone involved.

## Core Value

A unified hub where any authorized party — manager, owner, tenant, or vendor — can see exactly what they need and take exactly the actions they're allowed to, without phone calls, emails, or spreadsheets filling the gap.

## Requirements

### Validated

- ✓ Multi-tenant orgs, people, and role-based portals (manager / owner / tenant / vendor)
- ✓ Properties, units, leases, and owner/tenant records
- ✓ Maintenance work orders with vendor SMS (Pingram outbound)
- ✓ Expenses and payments with owner statements (billed_amount only to owners)
- ✓ Listings, Gmail inbox, and related Canary manager app surfaces

### Active

- [ ] Staff can text a shared number to draft an owner bill-back (supplies × 1.30 + labour × $50/hr + 15% HST) and confirm with Y
- [ ] Expense rows store the full staff breakdown; owners see only subtotal before HST and total after HST
- [ ] Confirmed SMS notes teach later shorthand (e.g. "Airbnb Restock")

### Out of Scope

- Auto-posting inferred charges without Y — too easy to bill the wrong owner
- Tenant charges via this SMS flow — this is owner ledger bill-back only
- Per-sender phone numbers — one shared inbox number; identity from `from`

## Context

Brownfield GSD stub created 2026-08-24 so `/gsd:quick` can run. The live app already exists; these files were missing from `.planning/`. Design for SMS capture: `.planning/notes/2026-08-24-sms-charge-capture-design.md`.

## Constraints

- **Privacy**: Owner contact info for tenants is restricted until offboarding
- **Approval**: Maintenance expense approval gate at $500 (owner must approve above)
- **Tax**: Newfoundland HST 15%; labour $50/hr; supplies markup 30% (org defaults)
- **Stack**: Next.js 15, React 19, Tailwind 4, Supabase, Pingram (CA), Vercel
- **Mobile**: Managers and tenants use phones — capture via SMS is the point

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Confirm via SMS Y/N before posting | Natural language + nicknames will be wrong sometimes | — Pending |
| Owner sees subtotal + total only | Cost, markup, labour, photos, notes stay staff-only | — Pending |
| Shared Pingram number, identity from sender | One number to remember; `people.phone` maps staff | — Pending |
| Org defaults 30% / $50/hr / 15% HST | Matches current Canary billing; snapshot on each expense | — Pending |

---
*Last updated: 2026-08-24 after brownfield GSD stub for SMS charge capture*
