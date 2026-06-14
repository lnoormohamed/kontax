# Runbook: Environment variables & secrets

**Subsystem:** All env vars required to run Kontax in production  
**Audience:** Engineers setting up a new environment or rotating secrets

---

## Overview

All env vars are validated at startup by `src/env.js` (using `@t3-oss/env-nextjs`). Missing required vars crash the process with a clear message. Optional vars degrade gracefully (e.g. SES falls back to console logging, MinIO falls back to URL-only avatar mode).

The canonical reference is `.env.example` in the repo root. This runbook adds rotation guidance.

---

## Required in all environments

| Variable | Purpose | How to generate / where to find |
|----------|---------|--------------------------------|
| `DATABASE_URL` | PostgreSQL connection string | Coolify DB service or external Postgres |
| `AUTH_SECRET` | NextAuth JWT signing secret | `npx auth secret` |
| `APP_URL` | Public origin (e.g. `https://kontax.vexon.co`) | Set to the production domain |

---

## Auth & sessions

| Variable | Notes |
|----------|-------|
| `AUTH_SECRET` | Changing this invalidates **all** active sessions site-wide. Coordinate with users before rotating. After rotation, increment is handled automatically by NextAuth. |
| `TOTP_ENCRYPTION_KEY` | 32-byte hex key used to encrypt TOTP secrets at rest. Rotating requires re-encrypting all stored TOTP secrets — **do not rotate casually**. Generate: `openssl rand -hex 32`. |

---

## Database

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | Includes host, port, db name, user, password. If the password rotates, update here and redeploy. Schema changes are applied by `prisma db push` on the next deploy. |

---

## Rate limiting

| Variable | Notes |
|----------|-------|
| `REDIS_URL` | Self-hosted Valkey (Redis-compatible). Falls back to in-memory store if unset — **not suitable for production** as limits are not shared across container restarts. Format: `redis://host:6379`. |

---

## Blob storage (MinIO)

| Variable | Notes |
|----------|-------|
| `MINIO_ENDPOINT` | Public HTTPS URL of the MinIO instance. |
| `MINIO_ACCESS_KEY` | MinIO access key. Rotate in MinIO console → Access Keys. |
| `MINIO_SECRET_KEY` | MinIO secret key. Rotate alongside access key. |
| `MINIO_BUCKET` | Bucket name (default: `kontax-uploads`). |
| `MINIO_PUBLIC_URL` | Public base URL for uploaded files. May differ from `MINIO_ENDPOINT` if behind a CDN. |

If any MinIO var is unset, avatar upload falls back to URL-input-only mode (user pastes an HTTPS URL instead of uploading a file).

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
| `CRON_SECRET` | Sent as `x-cron-secret` header by the LXC cron `curl` calls. Generate: `openssl rand -hex 32`. Rotating requires updating the LXC crontab and the Coolify env var. |

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

---

## References

- Env schema & validation: `src/env.js`
- Canonical example: `.env.example`
- SES setup: [ses-setup.md](ses-setup.md)
- Stripe rotation: [stripe-billing.md](stripe-billing.md)
