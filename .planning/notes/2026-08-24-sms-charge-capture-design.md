---
title: SMS charge capture design
date: "2026-08-24 14:16"
promoted: false
context: Exploration of texting notes that become owner bill-backs
---

# SMS charge capture

Staff text one shared Canary number. The app drafts an owner expense, texts back a breakdown, and posts only after **Y**. The sender's phone maps to a staff user; the posted expense shows who sent it.

## Channel

- Pingram dedicated A2P number (already used for outbound SMS, Canadian region).
- Inbound via `SMS_INBOUND` webhook; MMS receipts in US/CA.
- Unknown numbers: ignore, do not reply.
- Confirm/cancel is a reply to the draft SMS (`Y` / `N`).

## Billing math (org defaults)

Snapshotted onto each expense so later rate changes do not rewrite history.

```
supplies_marked_up = round(supplies_cost × 1.30, 2)
labour             = round(hours × $50, 2)
subtotal           = supplies_marked_up + labour   # owner-visible, before HST
hst                = round(subtotal × 0.15, 2)
total              = subtotal + hst                # owner-visible billed amount
```

Example: `$48.62 in supplies billed to 73 Casey Street plus 2 hours of time`
→ supplies $63.21 + labour $100.00 → subtotal **$163.21** → after HST **$187.69**.

`$100` in a shorthand like "Charge 73 Casey $100" is two hours of labour, not a round owner total.

## Visibility

Owner (statement): date, category/label, **subtotal before HST**, **total after HST**.

Staff only: supplies cost, markup, labour hours/amount, photos/receipts, freeform notes, original SMS, who posted.

## Parser + learning

- v1: extract property, supplies, hours, category, note. Date = today. Property from fuzzy address ("73 Casey"). Ambiguous matches: SMS back `Reply 1 or 2`.
- Never auto-post. Draft always requires Y.
- After each confirmed post, store normalized job phrase → category / typical hours / typical supplies.
- Later: "Airbnb Restock 73 Casey" fills the draft from history; still requires Y.

## Prerequisite

`expenses` today only has `vendor_cost` + `billed_amount`. SMS capture sits on a real breakdown (see pending todo).
