# Open research questions

## Pingram dedicated CA number and unsolicited inbound SMS

**Asked:** 2026-08-24
**Context:** SMS charge capture (SEED-001). Staff must text a number at any time, not only as a reply to an outbound notification.

**Question:** Can a dedicated Pingram Canadian A2P number receive **unsolicited** inbound SMS/MMS (first message from staff, not a reply within 7 days of our last outbound), and deliver it to `SMS_INBOUND` with `from`, `to`, `text`, and `media`?

**Why it matters:** Pingram docs emphasize reply matching within 7 days of the last outbound message. Charge capture requires a standing inbox number. If unsolicited inbound is unsupported, v1 needs a workaround (periodic outbound ping to keep the thread open, email inbound, or a different SMS provider).

**Also confirm:**

- Provisioning steps and cost for a dedicated CA long code / 10DLC-equivalent number
- Webhook signature verification
- MMS inbound size/type limits for receipt photos
- STOP/HELP handling so staff do not accidentally opt the org number out
