# Runbook: Environment variables & secrets

**Subsystem:** All env vars required to run Kontax in production  
**Audience:** Engineers setting up a new environment or rotating secrets

---

## Overview

All env vars are validated at startup by `src/env.js` (using `@t3-oss/env-nextjs`). Missing required vars crash the process with a clear message. Optional vars degrade gracefully (e.g. SES falls back to console logging, MinIO falls back to URL-only avatar mode).

Two layers of validation run at boot:

1. **Per-variable schema** — types and formats, via `createEnv`.
2. **`assertProductionEnv()`** (P48-16) — the cross-field rule "these are required *in production*", which a per-variable schema cannot express without breaking dev. `@t3-oss/env-nextjs@0.12` has no schema-level refinement hook, so this is a plain function called at module scope in `src/env.js` (server-side only, skipped under `SKIP_ENV_VALIDATION`).

The canonical reference is `.env.example` in the repo root. This runbook adds rotation guidance.

---

## Required in production (P48-16)

The process **refuses to boot** when `NODE_ENV=production` (or
`KONTAX_DEPLOY_ENV=production`) and any of these is unset. The assertion lives in
`assertProductionEnv()` in `src/env.js` and runs at module scope, so the failure
is one clear message at startup rather than a surprise at the first email, sync
or login.

| Variable | Purpose | Generate with |
|----------|---------|---------------|
| `DATABASE_URL` | PostgreSQL connection string | Coolify DB service or external Postgres |
| `AUTH_SECRET` | NextAuth JWT signing secret; also the HKDF input for the impersonation cookie MAC | `npx auth secret` |
| `APP_URL` | Public origin — every absolute link we generate (email CTAs, OAuth redirects, share links, CardDAV URLs) | the production domain |
| `TOTP_ENCRYPTION_KEY` *or* `TOTP_ENCRYPTION_KEYS` | Encrypts stored TOTP secrets at rest | `openssl rand -hex 32` |
| `SYNC_CREDENTIAL_ENCRYPTION_KEY` *or* `SYNC_CREDENTIAL_ENCRYPTION_KEYS` | Encrypts stored provider credentials at rest | `openssl rand -hex 32` |
| `CRON_SECRET` | Guards the `/api/cron/*` endpoints | `openssl rand -hex 32` |
| `REDIS_URL` | Shared rate-limit store | Valkey service URL |

Why these and not the rest: each has a **silent** failure mode. An unset
`APP_URL` used to send password-reset links to an unrelated domain; an unset
`SYNC_CREDENTIAL_ENCRYPTION_KEY` silently reused the JWT signing secret as the
credential KEK; an unset `REDIS_URL` silently made rate limits per-process. The
optional vars (SES, MinIO, Stripe, OAuth connectors) degrade *visibly* instead
and stay optional.

`SKIP_ENV_VALIDATION=1` bypasses the assertion. It is set in the Docker **build**
stage only — never set it on a running production app.

---

## Auth & sessions

| Variable | Notes |
|----------|-------|
| `AUTH_SECRET` | **Blast radius: all active sessions.** Changing it signs users out site-wide and invalidates in-flight impersonation cookies (their HMAC key is `HKDF(AUTH_SECRET, "kontax:impersonation")`). Coordinate before rotating. It is also the *legacy* credential-encryption key — see the keyring section before rotating it on a deployment that still has rows under key id `legacy`. |
| `TOTP_ENCRYPTION_KEY` / `TOTP_ENCRYPTION_KEYS` | **Blast radius: none, when rotated through the keyring.** See "Rotating a credential or TOTP key" below. |

---

## Database

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | Includes host, port, db name, user, password. If the password rotates, update here and redeploy. Schema changes are applied by `prisma db push` on the next deploy. |

---

## At-rest encryption keyring (P48-16)

Provider credentials (`SyncAccount.credentialReference`) and TOTP secrets
(`User.totpSecret`) share one envelope format and one key-management scheme, so
both are rotatable **online**.

### Format

```
SYNC_CREDENTIAL_ENCRYPTION_KEYS="k2:<64 hex chars>,k1:<64 hex chars>"
TOTP_ENCRYPTION_KEYS="t2:<64 hex chars>,t1:<64 hex chars>"
```

Comma-separated `id:hex64` pairs, **current key first**. New ciphertext is
written under the first entry; every other entry is retained purely so existing
rows still decrypt. Key ids are free-form (`[A-Za-z0-9_.-]`, ≤64 chars) and
travel *inside* the envelope, so a row is decryptable without consulting any
other column. A malformed value throws at first use rather than being skipped —
a typo must not look like "all credentials suddenly unreadable".

### Keys that are always present

| Id | Source | Role |
|----|--------|------|
| first entry of `*_KEYS` | the keyring var | current — encrypts |
| `k1` (or `SYNC_CREDENTIAL_ENCRYPTION_KEY_ID`) | `SYNC_CREDENTIAL_ENCRYPTION_KEY` | decrypt-only when a keyring is also set; current otherwise |
| `t1` | `TOTP_ENCRYPTION_KEY` | same, for TOTP |
| `legacy` | `AUTH_SECRET` | decrypt-only. Rows written before a dedicated credential key existed used the JWT signing secret as the KEK; this entry keeps them readable. Only becomes *current* when nothing else is configured, which production forbids. |

### Envelope

`<prefix>:<base64url>` where the binary body is
`version(1) | keyIdLen(1) | keyId | iv(12) | tag(16) | ciphertext`, AES-256-GCM,
AAD `"<prefix>:<keyId>"`. Prefixes: `kontax-sync-v2`, `kontax-totp-v2`. The
content-encryption key is `HKDF-SHA256(keyMaterial, info)` with a per-context
info label, so the same key material never produces the same DEK in two
contexts. Implementation: `src/server/sync-credentials.ts` (shared primitives),
`src/server/totp-crypto.ts` (TOTP wrapper).

Older formats stay readable and are upgraded in place — `kontax-sync-v1`
(JSON envelope, `sha256(secret)` key) and the bare-base64url TOTP blob.

### Rotating a credential or TOTP key

**Blast radius: none.** Old and new keys coexist; no restart, no downtime, no
user impact.

1. Generate a key: `openssl rand -hex 32`.
2. **Prepend** it to the keyring var — the first entry is the one that encrypts —
   keeping every existing key in place. Redeploy.
   ```
   SYNC_CREDENTIAL_ENCRYPTION_KEYS="k3:<new>,k2:<old>,k1:<older>"
   ```
3. Dry-run, then apply:
   ```
   node scripts/rotate-sync-credential-key.mjs
   node scripts/rotate-sync-credential-key.mjs --apply
   node scripts/rotate-sync-credential-key.mjs --totp --apply   # TOTP too
   ```
   The script re-encrypts every row under the current key and reports how many
   are rotated / already current / unreadable. It exits non-zero if anything is
   unreadable.
4. Only once the script reports **0 unreadable and 0 rotated on a fresh run**,
   drop the retired key from the var and redeploy.

Rows are also re-encrypted **lazily**: the sync runner rewrites any credential
it successfully decrypts under a non-current key (`src/server/sync-runner.ts`),
so a slow rotation converges on its own. The script exists to finish the job
before you remove a key.

> **Removing a key that still has rows makes those rows permanently
> unreadable.** Always dry-run first. Recovery means the user reconnecting the
> provider (or re-enrolling 2FA).

Moving off the `legacy` (AUTH_SECRET-derived) key is the same procedure: set a
dedicated `SYNC_CREDENTIAL_ENCRYPTION_KEYS`, run the script, and keep
`AUTH_SECRET` itself unchanged (it stays registered as `legacy` for as long as
it is set).

---

## Rate limiting

| Variable | Notes |
|----------|-------|
| `REDIS_URL` | Self-hosted Valkey (Redis-compatible). **Required in production** (P48-16) — boot fails without it. Falls back to an in-memory store in dev/test only. Format: `redis://host:6379`. |

### Behaviour during a Redis outage (P48-16)

Every Redis-backed limiter is constructed with an `insuranceLimiter`: a
`RateLimiterMemory` with identical points/duration. When a Redis round-trip
fails, `rate-limiter-flexible` transparently retries the operation against that
in-process limiter.

- **All buckets keep limiting** — security-critical (login, password reset, TOTP,
  registration, step-up, sync elevation) *and* convenience (image proxy, REST
  API, contact form, card clicks). Protection degrades from cluster-wide to
  per-process; it does not disappear, and nobody is locked out.
- Counters start empty and are per-process, so effective limits are multiplied
  by the process count for the duration of the outage. That is the deliberate
  trade-off.
- A warning is logged **at most once a minute** per scope:
  `[Kontax] rate-limit store unavailable (…)`. Both the ioredis `error` event and
  the limiter call sites feed the same throttle.
- **Recovery needs no restart.** The next successful round-trip goes to Redis
  again; the memory counters simply age out.
- `checkRateLimit` distinguishes a `RateLimiterRes` rejection (over limit →
  `{ allowed: false }`) from a transport `Error` (store down → allowed, logged).
  With insurance configured the second case is unreachable, which is why
  `api-rate-limit.ts` no longer carries a "fail open" branch.

Login is consistent with the rest: `peekRateLimit` gates before the bcrypt
compare, and the failure-path `checkRateLimit` calls are awaited
(`src/server/auth/config.ts`) rather than fire-and-forget, so a failed attempt
is always counted before the response is returned.

**Verify on staging:** stop Valkey → log in with a wrong password 6 times; the
6th must still be refused by the limiter, the image proxy must still serve, and
exactly one warning per minute should appear. Start Valkey → no restart needed.

---

## Blob storage (MinIO)

| Variable | Notes |
|----------|-------|
| `MINIO_ENDPOINT` | Public HTTPS URL of the MinIO instance. |
| `MINIO_ACCESS_KEY` | MinIO access key. Rotate in MinIO console → Access Keys. |
| `MINIO_SECRET_KEY` | MinIO secret key. Rotate alongside access key. |
| `MINIO_BUCKET` | Bucket name (default: `kontax-uploads`). |
| `MINIO_PUBLIC_URL` | Public base URL for uploaded files. May differ from `MINIO_ENDPOINT` if behind a CDN. **Must be publicly reachable from users' browsers over HTTPS** — a private-network URL (e.g. `http://10.x…`) will not load client-side. |
| `NEXT_PUBLIC_MEDIA_HOST` | **(P46-02) Optional.** The public **origin** of the media host (e.g. `https://media.getkontax.com`). Only needed when `MINIO_PUBLIC_URL`'s origin is **not** `https://media.getkontax.com` (which is built-in). Set it to that origin so avatars resolve to a direct load + thumbnail instead of the SSRF proxy, and so the CSP `img-src` allows the host (both are derived from this var). **Build-time:** it's a `NEXT_PUBLIC_*` var — Next.js inlines it at **build**, so it must be present in the Coolify **build** environment, not just runtime. |

If any MinIO var is unset, avatar upload falls back to URL-input-only mode (user pastes an HTTPS URL instead of uploading a file).

### P46-02 avatar display — deploy checklist

Symptom this fixes: uploaded avatars don't display (broken image / initials only), or every avatar is slow because it's routed through `/api/image-proxy`.

1. **`MINIO_*` set** (esp. `MINIO_ENDPOINT`, `MINIO_PUBLIC_URL`) — without them uploads never store and `avatarUrl` stays null (initials only). This was the P44-06 blocker on `kontax.vexon.co`.
2. **`MINIO_PUBLIC_URL` is a public HTTPS origin.** For prod that is `https://media.getkontax.com` (already whitelisted). If so, **you're done** — the built-in legacy match handles it and `NEXT_PUBLIC_MEDIA_HOST` is **not** required.
3. **Only if `MINIO_PUBLIC_URL`'s origin ≠ `https://media.getkontax.com`:** set `NEXT_PUBLIC_MEDIA_HOST` to that origin **in the build environment**, then rebuild. The CSP `img-src` (next.config.js + middleware.ts) picks it up automatically — no manual CSP edit.
4. Verify: open a contact with a photo → the `<img src>` should be the direct media URL, **not** `/api/image-proxy?...`.

#### Per-environment media host (decided 2026-07-04)

Each environment needs a media host the **browser** can reach over HTTPS. A
private-network MinIO origin (e.g. `http://10.0.0.144:9000`) works for
server-side upload/storage but **never loads in a browser** — and the image
proxy refuses private IPs (SSRF), so there is no fallback either.

| | Prod | Staging |
|---|---|---|
| Public media host | `https://media.getkontax.com` | `https://media-staging.getkontax.com`¹ (own subdomain fronting the staging MinIO) |
| `MINIO_PUBLIC_URL` | `https://media.getkontax.com/kontax-uploads` | `https://media-staging.getkontax.com/kontax-uploads` |
| `NEXT_PUBLIC_MEDIA_HOST` | not needed (legacy match) | `https://media-staging.getkontax.com` (build-time) |
| Existing URL rewrite | none (empty DB pre-launch) | rewrite the baked `http://10.0.0.144:9000` URLs (below) |

¹ Exact subdomain is an infra choice — whatever you point at the staging MinIO
via Cloudflare/Traefik. The reverse proxy must preserve the
`/kontax-uploads/avatars/…` path so object keys resolve unchanged.

**Rewriting baked staging avatar URLs** (after the subdomain is live and
`MINIO_PUBLIC_URL` updated) — `scripts/rewrite-avatar-host.mjs`, dry-run first:

```
# dry-run (default, mutates nothing)
node --env-file-if-exists=.env --env-file-if-exists=.env.local \
  scripts/rewrite-avatar-host.mjs \
  --from http://10.0.0.144:9000/kontax-uploads \
  --to   https://media-staging.getkontax.com/kontax-uploads
# apply
… --commit
```

Objects don't move — only the URL base changes — so the new host must front the
**same** MinIO/bucket. Idempotent; safe to re-run.

---

## Email (Amazon SES)

All four must be set together — if any is missing, `SES_CONFIGURED` is false and emails log to the console only.

| Variable | Notes |
|----------|-------|
| `AWS_ACCESS_KEY_ID` | IAM user with `ses:SendEmail` permission. |
| `AWS_SECRET_ACCESS_KEY` | Rotate in AWS IAM → rotate access key (create new → update here → delete old). |
| `AWS_SES_REGION` | Region where the SES domain identity was verified (e.g. `us-east-1`). |
| `EMAIL_FROM` | Must be an address on the verified SES domain (e.g. `noreply@vexon.co`). |

See [ses-setup.md](ses-setup.md) for full SES configuration.

---

## Cron jobs

| Variable | Notes |
|----------|-------|
| `CRON_SECRET` | Sent as `x-cron-secret` header by the LXC cron `curl` calls. Generate: `openssl rand -hex 32`. **Required in production.** **Blast radius: every cron job, until the crontab is updated.** Rotating means updating the LXC 152 crontab *and* the Coolify env var — the app compares with a timing-safe equality check and there is no grace window for the old value, so the two must land together. Rotate during a quiet slot between job runs, then confirm the next scheduled run succeeds. |

Cron endpoints: `/api/cron/delete-accounts`, `/api/cron/birthday-reminders`, `/api/cron/data-export`, `/api/cron/expire-exports`, `/api/cron/digest`, `/api/cron/cleanup-card-views`, `/api/cron/reset-api-counters`.

---

## Google sync (OAuth)

| Variable | Notes |
|----------|-------|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console. |
| `GOOGLE_CLIENT_SECRET` | Rotate in Google Cloud Console → Credentials → rotate secret. Update here and redeploy. Existing user tokens remain valid. |
| `GOOGLE_REDIRECT_URI` | Must match the authorised redirect URI in Google Cloud Console (e.g. `https://kontax.vexon.co/api/sync/google/callback`). |

The Google sync connector is only shown to users when all three are set.

---

## Microsoft / Outlook sync (OAuth)

| Variable | Notes |
|----------|-------|
| `MICROSOFT_CLIENT_ID` | Azure AD app registration client ID. |
| `MICROSOFT_CLIENT_SECRET` | Rotate in Azure → App registrations → Certificates & secrets. |
| `MICROSOFT_TENANT_ID` | `common` allows personal + work accounts; `organizations` restricts to work accounts. |
| `MICROSOFT_REDIRECT_URI` | Must match the redirect URI in the Azure app registration. |

---

## Stripe billing

| Variable | Notes |
|----------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_...` in production. Never expose client-side. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` — get from Stripe dashboard → Webhooks → your endpoint. See [stripe-billing.md](stripe-billing.md) for rotation steps. |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | Price IDs from Stripe dashboard → Products. Update when prices change. |
| `STRIPE_PRICE_ID_PRO_YEARLY` | |
| `STRIPE_PRICE_ID_FAMILY_MONTHLY` | |
| `STRIPE_PRICE_ID_FAMILY_YEARLY` | |
| `STRIPE_PRICE_ID_TEAMS_MONTHLY` | |
| `STRIPE_PRICE_ID_TEAMS_YEARLY` | |
| `NEXT_PUBLIC_PRICE_PRO_MONTHLY` | Display string shown on the pricing page (e.g. `£8`). Public — no secret. |
| `NEXT_PUBLIC_PRICE_*` | Same for all other plans. |

---

## Secret rotation checklist

When rotating a secret:
1. Generate the new value.
2. Update the env var in Coolify → Environment variables.
3. Trigger a redeploy (required — env vars are read at startup).
4. Verify the feature that depends on the secret still works.
5. Delete the old secret from the upstream service (AWS, Stripe, Google, etc.).

### Blast radius at a glance

| Secret | Impact of rotating | Procedure |
|--------|-------------------|-----------|
| `AUTH_SECRET` | **All sessions dropped.** Users must sign in again; active impersonation cookies die. Also the `legacy` credential key — do not *remove* it while rows remain under key id `legacy`. | Announce, rotate, redeploy |
| `SYNC_CREDENTIAL_ENCRYPTION_KEY(S)` | **None** when done via the keyring | [Rotating a credential or TOTP key](#rotating-a-credential-or-totp-key) |
| `TOTP_ENCRYPTION_KEY(S)` | **None** when done via the keyring | same, with `--totp` |
| `CRON_SECRET` | All cron jobs fail until the LXC 152 crontab is updated to match | Update crontab + env var together |
| `REDIS_URL` | Rate-limit counters reset (buckets re-fill from empty); no user impact | Rotate, redeploy |
| `DATABASE_URL` | Downtime for the length of the redeploy | Rotate, redeploy |
| `MINIO_*` | Avatar upload falls back to URL-only until corrected | Rotate in MinIO console, redeploy |
| Stripe / Google / Microsoft | Existing user tokens stay valid; new flows fail until updated | See the per-provider sections above |

---

## References

- Env schema & validation: `src/env.js` (`assertProductionEnv`)
- Canonical example: `.env.example`
- Keyring + envelope: `src/server/sync-credentials.ts`, `src/server/totp-crypto.ts`
- Key rotation script: `scripts/rotate-sync-credential-key.mjs`
- Rate-limit outage policy: `src/server/rate-limit.ts`
- Shared `APP_URL` resolver: `src/lib/site-url.ts` (`getAppUrl`)
- Ticket: `roadmap/build-phase/p48-16-rate-limit-policy-env-key-rotation.md`
- SES setup: [ses-setup.md](ses-setup.md)
- Stripe rotation: [stripe-billing.md](stripe-billing.md)
