# Runbook: Deploy & schema

**Subsystem:** Deployment pipeline — Coolify / Proxmox LXC 114, Docker, controlled schema startup policy  
**Audience:** Engineers and operators doing deploys or recovering from crashes

---

## Overview

Kontax runs as a Docker container managed by Coolify on Proxmox LXC 114.
Containers boot through:

```bash
node scripts/start-production.mjs
```

That startup script supports three schema modes:

- `push`
  - run `prisma db push --skip-generate` before app boot
- `validate`
  - compare the live database to `prisma/schema.prisma` and refuse to boot on drift
- `skip`
  - boot without a schema step

Default behavior:

- when `KONTAX_SCHEMA_MODE` is set, that value wins
- otherwise `KONTAX_DEPLOY_ENV=production` defaults to `validate`
- otherwise `NODE_ENV=production` with no `KONTAX_DEPLOY_ENV` also defaults to `validate`
- all other environments default to `push`

---

## Normal state

- Coolify shows the service as **Running** with a green indicator.
- The container logs show the selected schema mode completing successfully, followed by `Starting Kontax.` and `Ready on http://localhost:3000`.
- The site at `https://kontax.vexon.co` responds with HTTP 200.

---

## How to deploy

### Staging / convenience deploys

1. Push to the target branch (or trigger manually in Coolify).
2. Use `KONTAX_SCHEMA_MODE=push` when additive convenience is acceptable.
3. Watch the deploy log until startup completes.
4. Smoke-test the changed surface.

### Production deploys

1. Review whether the schema change is:
   - additive-safe
   - data-migration-sensitive
   - rollback-sensitive
2. Apply schema intentionally before the app swap:
   - additive-safe: run `npm run db:push` in a controlled release task
   - data migration: run the required SQL / backfill first, then apply the schema
3. Set `KONTAX_DEPLOY_ENV=production` and let startup run in `validate` mode.
4. Deploy the app code.
5. Watch logs until `Starting Kontax.` appears and the app is ready.
6. Smoke-test sign-in, contacts load, and the changed subsystem.

---

## Failure modes & recovery

### Schema validation boot failure

**Symptom:** Container exits immediately after starting. Coolify restarts it and it exits again. Logs show the schema validation step reporting drift.

**Cause:** The app is running in `validate` mode and the live database does not yet match `prisma/schema.prisma`. Note the mode is `validate` even on **staging** when `KONTAX_DEPLOY_ENV` is *unset* — an unset value under `NODE_ENV=production` infers `validate` for safety, so a staging app with no `KONTAX_DEPLOY_ENV` will crash-loop on additive drift instead of pushing it.

**Recovery:**
1. Open Coolify logs to confirm this is a validation failure rather than an app crash.
2. Apply the intended schema change manually against the target DB (point `DATABASE_URL` at it — e.g. staging `10.0.0.200`, prod `192.168.1.193`):
   - additive-safe: `npm run db:push` (verify the diff is `[+] Added`-only first with `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code`)
   - data migration: run SQL/backfill first, then apply the schema
3. Redeploy or restart the app so validation passes (confirm locally with `node scripts/check-schema-drift.mjs` → exit 0).
4. If you need to unblock immediately, revert the schema change and redeploy the previous app build.

> **Prevention:** set `KONTAX_DEPLOY_ENV=staging` on the staging app (→ `push` mode auto-applies additive schema) and `KONTAX_DEPLOY_ENV=production` on prod (→ `validate` + intentional apply). Leaving it unset is what forces a staging app into validate mode.

> **Never** run `prisma db push --accept-data-loss` in production. It silently drops columns or tables.

> **Incident 2026-07-04 (P40):** staging (`10.0.0.200`) crash-looped after the P40 multi-book schema landed — `KONTAX_DEPLOY_ENV` was unset → validate mode → additive drift (new `ContactBookMembership` / `ContactPrivateField` tables + `sharingPolicy` / `minimumSharingPolicy` / `destinationBookId` columns). Resolved by applying `npm run db:push` (all additive, no data-loss flag) then restart.

### Push-mode startup failure

**Symptom:** A non-production or explicitly `push` deployment crash-loops on startup with a Prisma error.

**Cause:** `prisma db push` found a change it could not apply safely (for example a new required column on a populated table).

**Recovery:**
1. Switch temporarily to `validate` or `skip` if you need logs from the app without mutating schema.
2. Rework the schema to be additive-safe or apply the required SQL manually.
3. Retry the deploy once the live DB and schema are compatible.

### Build failure

**Symptom:** Coolify shows the deploy as failed during the build stage (not startup). Logs show TypeScript or ESLint errors.

**Cause:** The Docker build runs `next build`, which treats ESLint errors as fatal. TypeScript errors also fail the build.

**Recovery:** Fix the errors locally (`npm run build` locally to reproduce), push a fix commit.

### APP_URL misconfigured

**Symptom:** CardDAV URLs, share links, and email CTAs point to `localhost:3000` or the wrong domain.

**Fix:** In Coolify, set `APP_URL=https://kontax.vexon.co` in the environment variables panel. Redeploy is required.

---

## Key environment variables for deploy

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Postgres connection string |
| `AUTH_SECRET` | Yes | NextAuth secret — generate with `npx auth secret` |
| `APP_URL` | Yes | Public origin, e.g. `https://kontax.vexon.co` |
| `CRON_SECRET` | Yes | LXC cron authenticates with this |
| `KONTAX_DEPLOY_ENV` | **Set on every app** | `production` in prod (→ `validate`), `staging` on staging (→ `push`). Leaving it unset under `NODE_ENV=production` forces `validate` and crash-loops staging on additive drift |
| `KONTAX_SCHEMA_MODE` | Optional | Explicitly force `push`, `validate`, or `skip` |

See [env-secrets.md](env-secrets.md) for the full variable inventory.

---

## References

- Dockerfile: `Dockerfile`
- Startup policy: `scripts/start-production.mjs`
- Drift check: `scripts/check-schema-drift.mjs`
- Prisma schema: `prisma/schema.prisma`
- Memory: [Email/SES deployment](../memory/project_email-ses-deployment.md)
