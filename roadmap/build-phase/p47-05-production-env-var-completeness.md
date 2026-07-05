# P47-05 — Production env-var completeness & validation

**Phase:** 47 · **Workstream:** A · **Priority:** P0 · **Depends on:** P47-01

## Objective

Set the **complete** production environment in Coolify LXC 122 so no feature
degrades silently, and confirm the app validates it at startup. The current prod
env is a P34D-era subset that predates MinIO wiring, the sync runner, Redis, and
export jobs.

## The trap

`src/env.js` makes almost everything `.optional()` — the app **boots fine with
half the env missing**, then silently drops into degraded modes: no MinIO →
URL-only avatars, no SES → console-only email, no Redis → in-memory limits, no
Stripe → billing disabled. "It started" is not "it's configured." This ticket
diffs the live env against the full inventory and fills every gap.

## Required in all environments (hard — app won't function correctly without)

| Var | Value / source |
|-----|----------------|
| `DATABASE_URL` | `postgresql://kontax:…@192.168.1.193:5432/kontax` |
| `AUTH_SECRET` | `npx auth secret` (rotating logs everyone out) |
| `APP_URL` | the canonical prod origin (see P47-11) |
| `KONTAX_DEPLOY_ENV` | **`production`** → boots in `validate` mode. Never leave unset under `NODE_ENV=production` |
| `TOTP_ENCRYPTION_KEY` | 64-char hex, `openssl rand -hex 32`. **Required in prod** (2FA). Do not rotate casually |
| `CRON_SECRET` | 64-char hex; must match LXC 152 crontab (P47-04) |

## Service groups (set the whole group or the feature stays off)

- **MinIO** — `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`,
  `MINIO_BUCKET`, `MINIO_PUBLIC_URL` (P47-02).
- **Redis** — `REDIS_URL` (P47-03).
- **Stripe** — `STRIPE_SECRET_KEY` (**live**), `STRIPE_WEBHOOK_SECRET`, all six
  `STRIPE_PRICE_ID_*`, plus public `NEXT_PUBLIC_PRICE_*` display strings (P47-08).
- **SES** — `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SES_REGION`,
  `EMAIL_FROM` — all four together or email stays console-only (P47-09).
- **Google OAuth** — `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` (P47-07).
- **Microsoft OAuth** — `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID/REDIRECT_URI` (P47-07).
- **Sync credential encryption** — `SYNC_CREDENTIAL_ENCRYPTION_KEY` (≥32) +
  `SYNC_CREDENTIAL_ENCRYPTION_KEY_ID` if sync stores credentials at rest.

## Build-time vars (must be present in Coolify **build** env, not just runtime)

- `NEXT_PUBLIC_MEDIA_HOST` — **not required for prod** (`media.getkontax.com` is
  the built-in match); if ever set, it must be at build time (Next inlines it).
- `NEXT_PUBLIC_PRICE_*` — pricing-page display strings (public, no secret).
- `NEXT_PUBLIC_ACTIVITY_LOG_START_DATE` — client-inlined (see off-schema table
  below); if used, it must be in the **build** env too.

## Off-schema vars (read via `process.env` directly — NOT in `src/env.js`)

`src/env.js` is **not** the complete inventory: seven vars are read straight
from `process.env` elsewhere in the tree, so a diff against `runtimeEnv` alone
misses them. Dump the **staging** Coolify env (the known-good configuration)
and mirror each decision explicitly:

| Var | Where read | Prod decision |
|-----|-----------|---------------|
| `PHOTO_SYNC_ENABLED` | `src/lib/photo-sync-flags.ts` | **Explicit go/no-go, record it** — default off; the P44-06 live QA never ran. If launching with photo sync on, set `1` (build + runtime); either way P47-02 step 5 depends on this decision |
| `ADMIN_CAPABILITY_OVERRIDES` | `src/server/admin/capabilities.ts` | mirror staging if set; else leave unset (code defaults apply) |
| `ADMIN_DEFAULT_TIER` | `src/server/admin/capabilities.ts` | mirror staging if set; else leave unset |
| `SESSION_VALIDATION_CACHE` | `src/server/session-validation-cache.ts` | mirror staging |
| `SYNC_COMMIT_TX_TIMEOUT_MS` | `src/server/sync-runner.ts` | tuning knob — mirror staging |
| `NEXT_PUBLIC_ACTIVITY_LOG_START_DATE` | `src/app/_components/contact-history.tsx` | **build-time** (client-inlined); mirror staging in the Coolify build env |
| `KONTAX_SCHEMA_MODE` | `scripts/start-production.mjs` | leave **unset** in prod — `KONTAX_DEPLOY_ENV=production` already resolves to `validate`; setting it overrides the deploy policy |

## Steps

1. Dump current Coolify env keys; diff against **both** `src/env.js`
   `runtimeEnv` **and** the off-schema table above → gap list. Also dump the
   **staging** Coolify env and diff prod against it — staging is the known-good
   reference and catches anything both lists miss.
2. Fill every gap; generate fresh secrets where none exist.
3. Redeploy (env is read at startup only).
4. Confirm the startup log prints `Deploy environment: production · … · schema
   mode: validate` and **no** "defaulting schema mode to validate for safety"
   warning (that warning means `KONTAX_DEPLOY_ENV` is unset).
5. Spot-check each degraded-mode boundary is now **on**: avatar upload button
   present (MinIO), a test email sends (SES), checkout reaches Stripe live.

## Acceptance

- Live env matches the full `src/env.js` inventory **plus** the off-schema
  table; no unintended degraded mode.
- The `PHOTO_SYNC_ENABLED` launch decision is recorded on the P47-01 checklist
  (on or off — not silently defaulted).
- Startup log shows `production` + `validate`, no fallback warning.
- Secret rotation steps (env-secrets §Secret rotation checklist) followed for any
  regenerated secret.
- Recorded on the P47-01 checklist.

## References

- `src/env.js` (authoritative), `.env.example`, env-secrets.md, deploy.md
</content>
