# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-24)

**Core value:** A unified hub where each party sees and does only what they're allowed to.
**Current focus:** Phase 2 — SMS charge capture

## Current Position

Phase: 2 of 2 (SMS charge capture)
Plan: 0 of ? in current phase
Status: Ready to execute (quick task)
Last activity: 2026-08-24 — Brownfield GSD stub; starting quick task for SMS charge capture

Progress: [█████░░░░░] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (GSD plans; app predates this stub)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Existing platform | shipped | — | — |
| 2. SMS charge capture | 0 | — | — |

## Accumulated Context

### Decisions

- Confirm SMS charges with Y/N; never auto-post inferred amounts
- Owner-visible: subtotal before HST + total after HST only
- Formula: supplies × 1.30 + hours × $50, then 15% HST; snapshot rates on the expense
- One shared Pingram number; `people.phone` identifies who posted

### Pending Todos

- Add expense billing breakdown and org rate defaults — `.planning/todos/pending/2026-08-24-expense-billing-breakdown.md`

### Blockers/Concerns

- Pingram unsolicited inbound (not only 7-day replies) is unconfirmed — `.planning/research/questions.md`

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260729-eri | SEO address slugs for public listings | 2026-07-29 | — | [260729-eri](./quick/260729-eri-add-seo-address-slugs-for-public-listing/) |
| 260729-fca | Garage property tag filter | 2026-07-29 | — | [260729-fca](./quick/260729-fca-add-has-garage-property-tag-filter-searc/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-08-24 14:20
Stopped at: Created brownfield PROJECT/ROADMAP/STATE so quick can run
Resume file: None
