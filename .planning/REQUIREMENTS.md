# Requirements: Canary PropOS

**Defined:** 2026-08-24
**Core Value:** Unified hub with role-appropriate access

## v1 Requirements (already in the live app)

Treated as validated. Not re-planned here.

## v2 Requirements — SMS charge capture

### Expenses

- [x] **EXP-01**: Expense stores supplies cost, markup, labour hours, subtotal, HST, and total; rates snapshotted from org defaults (30%, $50/hr, 15% HST)
- [x] **EXP-02**: Owners and tenants never see cost, markup, labour, photos, or notes — only subtotal before HST and total after HST

### SMS intake

- [x] **SMS-01**: Staff text one shared number; sender phone maps to a manager/employee/admin; unknown numbers ignored
- [x] **SMS-02**: App drafts property (fuzzy), date=today, category, supplies, hours, then texts breakdown; Y posts, N cancels
- [x] **SMS-03**: MMS receipts attach as staff-only files
- [x] **SMS-04**: Confirmed notes train later shorthand; inferred drafts still require Y

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-post without Y | Too easy to bill the wrong owner |
| Tenant charges via SMS | This flow is owner bill-back only |
| Per-person inbox numbers | One shared number |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXP-01 | Phase 2 | Complete (260824-jzb) |
| EXP-02 | Phase 2 | Complete (260824-jzb) |
| SMS-01 | Phase 2 | Complete (260824-jzb) |
| SMS-02 | Phase 2 | Complete (260824-jzb) |
| SMS-03 | Phase 2 | Complete (260824-jzb) |
| SMS-04 | Phase 2 | Complete (260824-jzb) |

---
*Requirements defined: 2026-08-24*
*Last updated: 2026-08-24 after quick task 260824-jzb*
