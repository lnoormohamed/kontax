# Runbook: Deploy & schema

**Subsystem:** Deployment pipeline — Coolify / Proxmox LXC 114, Docker, `prisma db push` on startup  
**Audience:** Engineers and operators doing deploys or recovering from crashes

---

## Overview

Kontax runs as a Docker container managed by Coolify on Proxmox LXC 114. Every time the container starts it runs:

```
npx prisma db push --skip-generate && npm start
```

This means **every deploy syncs the database schema to the current `prisma/schema.prisma`**. There are no migration files — schema state is always derived from the Prisma schema at deploy time.

---

## Normal state

- Coolify shows the service as **Running** with a green indicator.
- The container logs show `npx prisma db push` completing without error, followed by `Ready on http://localhost:3000`.
- The site at `https://kontax.vexon.co` responds with HTTP 200.

---

## How to deploy

1. Push to `main` on GitHub (or trigger manually in Coolify).
2. Coolify pulls the new image, builds it, runs the startup command, and swaps traffic over.
3. Watch Coolify's build + deploy log until you see `Ready`.
4. Smoke-test: open the site, sign in, check contacts load.

---

## Failure modes & recovery

### Schema drift crash-loop

**Symptom:** Container exits immediately after starting. Coolify restarts it and it exits again. Logs show a Prisma error like `The database schema is not in sync with the Prisma schema`.

**Cause:** `prisma db push` found changes it could not apply without data loss (e.g. adding a NOT NULL column to a populated table without a default, renaming a required field, changing a unique constraint). The command fails, the startup script exits non-zero, the container dies.

**Recovery:**
1. Open Coolify logs to read the full Prisma error.
2. If the schema change is backwards-compatible (adding a nullable column, adding a table): add a `@default(...)` or make the field optional in schema.prisma, redeploy.
3. If the change requires data migration: write a one-off SQL script, run it against the DB manually, then redeploy with the new schema.
4. If you need to unblock immediately: revert the `schema.prisma` change on `main`, push, let the old schema redeploy, then re-approach the migration safely.

> **Never** run `prisma db push --accept-data-loss` in production. It silently drops columns or tables.

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

See [env-secrets.md](env-secrets.md) for the full variable inventory.

---

## References

- Dockerfile: `Dockerfile` (line 39: startup command)
- Prisma schema: `prisma/schema.prisma`
- Memory: [Email/SES deployment](../memory/project_email-ses-deployment.md)
