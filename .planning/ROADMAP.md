# Roadmap: Canary PropOS

## Overview

The live multi-tenant property management app is already in use. Remaining planned work starts with SMS charge capture: staff text a shared number, the app drafts an owner bill-back with the real Canary formula, and posts only after Y.

## Phases

- [x] **Phase 1: Existing platform** - Orgs, people, properties, leases, maintenance, billing, listings, and portals already in the repo
- [ ] **Phase 2: SMS charge capture** - Expense billing breakdown + Pingram inbound notes that become confirmed owner bill-backs

## Phase Details

### Phase 1: Existing platform
**Goal**: The product Canary already runs
**Depends on**: Nothing
**Success Criteria**:
  1. Managers can operate properties, people, maintenance, and payments in the app
  2. Owners see billed amounts on statements, never vendor cost
  3. Vendors can be notified of jobs by SMS
**Plans**: shipped in-repo (no GSD plan files)

### Phase 2: SMS charge capture
**Goal**: Staff text one number; a confirmed draft posts an owner expense with correct markup, labour, and HST
**Depends on**: Phase 1
**Requirements**: SMS-01, SMS-02, SMS-03, EXP-01
**Success Criteria**:
  1. Staff can text supplies + hours + property and receive a draft with subtotal and HST
  2. Reply Y posts the expense; owners see only subtotal and total
  3. Shorter notes can be drafted from confirmed history (still require Y)
**Plans**: TBD (may start as `/gsd:quick`)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Existing platform | shipped | Complete | 2026-08-24 (stub) |
| 2. SMS charge capture | 0/? | Not started | - |
