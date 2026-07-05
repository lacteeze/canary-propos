# Supabase Auth Dashboard Configuration Checklist

> Settings that cannot be managed via migration files. Must be configured manually in the
> Supabase Dashboard before any auth feature ships. Updated by: Phase 1, Plan 04.

---

## 1. Google OAuth (FOUND-02)

- [ ] Dashboard → Authentication → Providers → Google
- [ ] Enable Google provider
- [ ] Paste **OAuth Client ID** (from Google Cloud Console)
- [ ] Paste **OAuth Client Secret** (from Google Cloud Console)
- [ ] In Google Cloud Console → Authorized redirect URIs, add:
  `https://<your-project-ref>.supabase.co/auth/v1/callback`
- [ ] In Google Cloud Console → Authorized JavaScript origins, add:
  `https://app.canarypm.ca`

**If Google credentials are unavailable:** Mark as deferred. Email/password + magic link must work regardless.

---

## 2. Apple OAuth (FOUND-03)

- [ ] Dashboard → Authentication → Providers → Apple
- [ ] Enable Apple provider
- [ ] Paste **Services ID** (from Apple Developer portal, format: `com.canarypm.signin`)
- [ ] Paste **Key ID** and **Private Key** (.p8 file contents) from Apple Developer
- [ ] In Apple Developer → Service ID → Web Authentication → Domains, add: `app.canarypm.ca`
- [ ] In Apple Developer → Service ID → Return URLs, add:
  `https://<your-project-ref>.supabase.co/auth/v1/callback`

**If Apple credentials are unavailable:** Mark as deferred.

---

## 3. Magic Link / Custom SMTP (FOUND-04)

- [ ] Dashboard → Authentication → SMTP Settings
- [ ] Enable custom SMTP
- [ ] Host: `smtp.resend.com`
- [ ] Port: `465` (SSL) or `587` (TLS)
- [ ] Username: `resend`
- [ ] Password: your `RESEND_API_KEY` (from Resend dashboard)
- [ ] Sender email: `noreply@canarypm.ca` (must be verified domain in Resend)
- [ ] Sender name: `Canary PropOS`

> Magic links use Supabase's built-in email flow relayed through Resend as SMTP.

---

## 4. Session Duration (D-10)

- [ ] Dashboard → Authentication → Configuration → Sessions
- [ ] Set **JWT expiry** to `604800` seconds (7 days)
- [ ] Enable **refresh token rotation**
- [ ] Set **refresh token reuse interval** to `10` seconds (prevents token replay attacks)

> Session refreshes on each active visit via middleware cookie rotation. Expires after 7 days
> of inactivity (D-10).

---

## 5. Realtime — Private Channels Only (FOUND-14)

- [ ] Dashboard → Project Settings → Realtime
- [ ] Enable **"Private channels only"**

> **CRITICAL:** Must be enabled before any Realtime feature ships. Without this setting,
> Realtime channels are public and any authenticated user can subscribe to any channel
> regardless of org membership — this would allow cross-org event leakage (T-04-03).
>
> Private channels require the Supabase client to pass a signed JWT and Supabase verifies
> channel authorization against `realtime.messages` policies before delivering events.

---

## 6. Allowed Redirect URLs

- [ ] Dashboard → Authentication → URL Configuration
- [ ] **Site URL:** `https://app.canarypm.ca`
- [ ] **Redirect URLs (allowed list):**
  - `https://app.canarypm.ca/**`
  - `http://localhost:3000/**` (local development)

---

## 7. Email Templates (optional customization)

- [ ] Dashboard → Authentication → Email Templates
- [ ] Review the magic link email template — Supabase default is functional but plain
- [ ] Phase 5 (Invites) will override with react-email/Resend templates; leave defaults for now

---

## Status

| Setting | Status | Notes |
|---------|--------|-------|
| Google OAuth | Pending | Requires Google Cloud Console credentials |
| Apple OAuth | Pending | Requires Apple Developer account + .p8 key |
| Magic link / SMTP | Pending | Requires Resend API key + verified `canarypm.ca` domain |
| Session duration (7 days) | Pending | Configure JWT expiry in Supabase dashboard |
| Realtime private-only | **Required before Phase 2** | Enable immediately — security gate |
| Redirect URLs | Pending | Add app.canarypm.ca to allowed list |

---

*Last updated: Phase 1, Plan 04 — session middleware and portal shells*
