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

**Cause:** The app is running in `validate` mode and the live database does not yet match `prisma/schema.prisma`.

**Recovery:**
1. Open Coolify logs to confirm this is a validation failure rather than an app crash.
2. Apply the intended schema change manually:
   - additive-safe: `npm run db:push`
   - data migration: run SQL/backfill first, then apply the schema
3. Redeploy or restart the app so validation passes.
4. If you need to unblock immediately, revert the schema change and redeploy the previous app build.

> **Never** run `prisma db push --accept-data-loss` in production. It silently drops columns or tables.

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
| `KONTAX_DEPLOY_ENV` | Recommended | Set to `production` in prod so startup defaults to schema validation |
| `KONTAX_SCHEMA_MODE` | Optional | Explicitly force `push`, `validate`, or `skip` |

See [env-secrets.md](env-secrets.md) for the full variable inventory.

---

## References

- Dockerfile: `Dockerfile`
- Startup policy: `scripts/start-production.mjs`
- Drift check: `scripts/check-schema-drift.mjs`
- Prisma schema: `prisma/schema.prisma`
- Memory: [Email/SES deployment](../memory/project_email-ses-deployment.md)
