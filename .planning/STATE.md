# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-24)

**Core value:** A unified hub where each party sees and does only what they're allowed to.
**Current focus:** Phase 2 — SMS charge capture

## Current Position

Phase: 2 of 2 (SMS charge capture)
Plan: complete (quick task 260824-jzb)
Status: Code complete — awaiting Pingram dashboard setup
Last activity: 2026-08-24 - Completed quick task 260824-jzb: Implement SMS charge capture: expense billing breakdown plus Pingram inbound SMS inbox with Y/N confirm and learning from confirmed notes

Progress: [██████████] 100% (code; ops setup remaining)

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (GSD plans; app predates this stub)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Existing platform | shipped | — | — |
| 2. SMS charge capture | 1 (quick 260824-jzb) | — | — |

## Accumulated Context

### Decisions

- Confirm SMS charges with Y/N; never auto-post inferred amounts
- Owner-visible: subtotal before HST + total after HST only
- Formula: supplies × 1.30 + hours × $50, then 15% HST; snapshot rates on the expense
- One shared Pingram number; `people.phone` identifies who posted
- Optional AI SMS parse only when `AI_GATEWAY_API_KEY` is set
- `pingram_webhook_events` is service-role only (RLS on, no user policies)

### Pending Todos

- *(none — expense billing breakdown shipped in 260824-jzb)*

### Blockers/Concerns

- Pingram unsolicited inbound (not only 7-day replies) is unconfirmed — `.planning/research/questions.md`

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260729-eri | SEO address slugs for public listings | 2026-07-29 | — | [260729-eri](./quick/260729-eri-add-seo-address-slugs-for-public-listing/) |
| 260729-fca | Garage property tag filter | 2026-07-29 | — | [260729-fca](./quick/260729-fca-add-has-garage-property-tag-filter-searc/) |
| 260824-jzb | SMS charge capture + expense billing | 2026-08-24 | 70f513b | [260824-jzb](./quick/260824-jzb-implement-sms-charge-capture-expense-bil/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-08-24 17:10
Stopped at: Completed quick task 260824-jzb (docs commit)
Resume file: None
