# Runbook: Deploy & schema

**Subsystem:** Deployment pipeline — Coolify / Proxmox LXC 114, Docker, controlled schema startup policy  
**Audience:** Engineers and operators doing deploys or recovering from crashes

---

## Overview

Kontax runs as a Docker container managed by Coolify on Proxmox LXC 114.
Containers boot through:

```bash
node scripts/runtime/start-production.mjs
```

That startup script supports four schema modes:

- `migrate` **(production default since P48-14)**
  - print `prisma migrate status`, run `prisma migrate deploy`, then re-run the
    drift assessment as a post-check and refuse to boot if the DB is still
    missing anything the schema requires
- `push`
  - run `prisma db push --skip-generate` before app boot
- `validate`
  - read-only pre-flight: refuse to boot on pending/failed migrations or on
    drift, but apply nothing
- `skip`
  - boot without a schema step

Default behavior:

- when `KONTAX_SCHEMA_MODE` is set, that value wins
- otherwise `KONTAX_DEPLOY_ENV=production` defaults to `migrate`
- otherwise `NODE_ENV=production` with no `KONTAX_DEPLOY_ENV` also defaults to `migrate`
- all other environments default to `push`

---

## Migration history (P48-14)

`prisma/migrations/` is the source of truth for the production schema. Before
P48-14 there was no migration history at all: production schema changes were
applied by `db push` at boot, which is why several constraints (`User.calToken`,
`SyncAccount.connectionId`, the sync lineage links) were deliberately *not*
enforced in the database — adding a unique index via `db push` would have
crash-looped the deploy.

Layout:

| Migration | Contents |
|-----------|----------|
| `0_init` | Baseline snapshot of the schema as it stood when migrations were introduced. **Never run against an existing environment** — see the one-time step below. |
| `20260914120000_p48_14_constraints` | `@unique` on `User.calToken`, `SyncAccount.connectionId`, `replacesSyncAccountId`, `replacedBySyncAccountId`; admin actor FKs switched from `Cascade` to `SetNull` with nullable actor ids and denormalised actor emails (backfilled in the same migration). |
| `20260914120100_p48_14_fk_indexes` | FK-leading indexes on every child column an `ON DELETE` action walks; drops five single-column indexes that duplicated a `UNIQUE` index. |

### One-time baseline step (production AND staging)

Production and staging already contain the `0_init` tables, so the baseline
must be **marked as applied**, not executed. Run this once per pre-existing
environment, before the first `migrate`-mode deploy:

```bash
# From a workstation/CI checkout, DATABASE_URL pointed at the target DB.
# Do NOT run `migrate deploy` first — it would try to CREATE TABLE over live data.
DATABASE_URL=<target> npx prisma migrate resolve --applied 0_init
DATABASE_URL=<target> npx prisma migrate status    # 0_init applied, 2 pending
```

`npm run db:migrate:resolve:baseline` is the same command.

A brand-new empty database needs none of this — `prisma migrate deploy` applies
all three migrations in order.

### Pre-check before the constraints migration

`20260914120000_p48_14_constraints` creates four UNIQUE indexes. Postgres builds
a unique index in one statement that **aborts if existing rows already violate
it** — which fails `migrate deploy` and crash-loops the container. Run the
read-only pre-check against each environment first and do not deploy until it
is clean:

```bash
DATABASE_URL=<target> npm run db:precheck:p48-14
# exit 0 = clear · exit 1 = duplicates (reconcile first) · exit 2 = check failed
```

If it reports duplicate `connectionId` / lineage values, reconcile with
`DATABASE_URL=<target> npm run backfill:sync-lineage` and re-run. Duplicate
`calToken` values are a credential-sharing incident, not just a constraint
problem — rotate the affected tokens and notify security before proceeding.

### Full production deploy sequence for P48-14

```bash
# 1. read-only pre-check (must exit 0)
DATABASE_URL=<prod> npm run db:precheck:p48-14

# 2. baseline the migration history (once, if not already done)
DATABASE_URL=<prod> npx prisma migrate resolve --applied 0_init

# 3. confirm what is pending
DATABASE_URL=<prod> npx prisma migrate status

# 4. deploy the app. With KONTAX_DEPLOY_ENV=production the container runs
#    `prisma migrate deploy` itself at boot. To apply out of band instead,
#    run this first and set KONTAX_SCHEMA_MODE=validate on the app:
DATABASE_URL=<prod> npm run db:migrate
```

### Rollback

`migrate deploy` has no built-in down-migration — Prisma does not generate them.
To roll back:

1. **Prefer rolling forward.** Write a new migration that reverses the change
   and deploy it; the history stays linear and honest.
2. If the app must be reverted *now*, redeploy the previous image with
   `KONTAX_SCHEMA_MODE=skip`. Both P48-14 migrations are backwards-compatible
   with the previous app build — the added indexes and constraints are
   invisible to it, and the nullable actor columns are additive — so the old
   code runs against the migrated schema.
3. To reverse the schema itself, apply the inverse SQL by hand (drop the four
   unique indexes / the added indexes; restoring the `Cascade` actor FKs
   requires the actor columns to be non-null again, so it is only possible if
   no actor has been deleted since) and then
   `prisma migrate resolve --rolled-back <migration_name>`.

### Adding a schema change from here on

```bash
# against a local dev DB
npm run db:generate    # prisma migrate dev — writes prisma/migrations/<ts>_<name>/
```

Commit the generated `migration.sql` with the `schema.prisma` change in the same
PR. Do not apply schema changes to production with `db push` any more.

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

1. Review the migration(s) in the PR (`prisma/migrations/<ts>_<name>/migration.sql`)
   and whether the change is:
   - additive-safe
   - data-migration-sensitive (run any required backfill/pre-check first —
     each migration's header comment names it)
   - rollback-sensitive (see Rollback above)
2. Run any pre-check the migration's header calls for, e.g.
   `DATABASE_URL=<prod> npm run db:precheck:p48-14`.
3. Set `KONTAX_DEPLOY_ENV=production` and let startup run in `migrate` mode,
   which applies pending migrations before boot. To apply out of band instead,
   run `npm run db:migrate` in a controlled release task and set
   `KONTAX_SCHEMA_MODE=validate` on the app.
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
   - migration history present (prod/staging since P48-14): `npm run db:migrate:status` then `npm run db:migrate`
   - additive-safe, no migration yet: `npm run db:push` (verify the diff is `[+] Added`-only first with `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` — note this reads `DATABASE_URL` from the environment rather than argv, so the password never appears in `ps`)
   - data migration: run SQL/backfill first, then apply the schema
3. Redeploy or restart the app so validation passes (confirm locally with `node scripts/runtime/check-schema-drift.mjs` → exit 0).
4. If you need to unblock immediately, revert the schema change and redeploy the previous app build.

> **Prevention:** set `KONTAX_DEPLOY_ENV=staging` on the staging app (→ `push` mode auto-applies additive schema) and `KONTAX_DEPLOY_ENV=production` on prod (→ `validate` + intentional apply). Leaving it unset is what forces a staging app into validate mode.

> **Never** run `prisma db push --accept-data-loss` in production. It silently drops columns or tables.

> **Incident 2026-07-04 (P40):** staging (`10.0.0.200`) crash-looped after the P40 multi-book schema landed — `KONTAX_DEPLOY_ENV` was unset → validate mode → additive drift (new `ContactBookMembership` / `ContactPrivateField` tables + `sharingPolicy` / `minimumSharingPolicy` / `destinationBookId` columns). Resolved by applying `npm run db:push` (all additive, no data-loss flag) then restart.

### Migrate-mode startup failure (P48-14)

**Symptom:** Container crash-loops. Logs show `prisma migrate deploy` failing,
or the post-check message "The live DB is MISSING objects the committed schema
requires even after migrate deploy".

**Causes and recovery:**

- **`P3005: The database schema is not empty`** — the environment was never
  baselined. Run the one-time
  `npx prisma migrate resolve --applied 0_init` (see above), then redeploy.
- **A `CREATE UNIQUE INDEX` aborted on duplicate values** — the pre-check was
  skipped. The failed migration is now recorded as failed, so `migrate deploy`
  will refuse to proceed until it is resolved. Fix the data
  (`npm run db:precheck:p48-14` reports exactly what collides), then
  `npx prisma migrate resolve --rolled-back <migration_name>` and redeploy so
  it is retried.
- **Post-check reports missing objects** — a schema change was committed
  without its migration file. Generate the missing migration
  (`npm run db:generate` locally), commit it, redeploy. To restore service
  first, redeploy the previous image.
- **Need the app up immediately regardless:** set `KONTAX_SCHEMA_MODE=skip` to
  boot without a schema step, then fix the migration state out of band. Only do
  this knowing the app may be running against a schema it does not match.

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

## Image layout & running admin scripts (P48-15)

The runtime image is a pruned, non-root, multi-stage build — it does **not**
contain `src/`, the wider `scripts/` tree, or dev tooling (eslint,
typescript, playwright, tailwind). Two stages:

- **builder** (`node:22-alpine`): `npm ci` (installs `devDependencies` too,
  and its `postinstall` runs `prisma generate` against the container's own
  Linux target — never the repo's committed output, since `generated/` is
  gitignored and dockerignored) → `next build` → `npm prune --omit=dev`,
  then `prisma` (the CLI, a devDependency) is reinstalled on its own because
  `scripts/runtime/start-production.mjs` and
  `scripts/runtime/check-schema-drift.mjs` shell out to
  `npx prisma db push` / `prisma migrate diff` at boot.
- **runner** (`node:22-alpine`, `USER node`): copies only `.next`, `public`,
  `next.config.js`, `server.mjs`, `prisma/` (schema + migrations),
  the pruned `node_modules`, `generated/` **from the builder**, `package.json`,
  and `scripts/runtime/` (`start-production.mjs`, `check-schema-drift.mjs`,
  `setup-contact-search-index.mjs`).

Everything else that used to ship in the image — the 40+ seed/backfill/QA
scripts in `scripts/` (`seed-demo-showcase.mjs`, `grant-admin.mjs`,
`rollback-teams-billing-to-org.mjs`, the phase37/44/45 harnesses, etc.) and
`src/` itself — is **not present in the running container**. `docker run
kontax ls scripts` only lists `runtime/`; `docker run kontax ls src` fails
with "No such file or directory". This is intentional: those scripts are
one-off/admin tooling, not boot-path code, and keeping them out of the image
shrinks the attack surface if the container is ever compromised.

**To run an admin/seed script against a deployed environment**, you need a
full checkout, not the runtime image. Options, in order of preference:

1. **From a workstation/CI runner with the repo checked out** (normal case):
   point `DATABASE_URL` (and any other required env) at the target database
   and run the script directly, e.g.
   `DATABASE_URL=<target> npm run search:setup-index` or
   `DATABASE_URL=<target> node scripts/grant-admin.mjs <email>`. This is how
   `reconcile-books-to-personal-work.mjs`, `seed:sort-romanization`, and
   similar one-offs are already run per the
   [P47 production readiness runbook](p47-production-readiness.md).
2. **One-off `docker build --target builder`**: the `builder` stage still has
   the full `scripts/` tree and `node_modules` (including devDependencies).
   `docker build --target builder -t kontax-builder .` then
   `docker run --rm -e DATABASE_URL=<target> kontax-builder node scripts/<script>.mjs`
   runs a script without touching your local machine's Node/npm setup.
3. **A maintenance/ops host (e.g. the Proxmox LXC)** with its own checkout
   and network access to the target DB, for scripts that need to run
   repeatedly or on a schedule (cron backfills, etc.).

Never add an admin/seed script to `scripts/runtime/` just to make it
reachable in the running container — that directory is an intentional
allowlist of boot-path code only (see P48-15).

> **Known gap:** `package.json`'s `search:setup-index` script still points at
> the old `scripts/setup-contact-search-index.mjs` path (package.json is
> owned by a different P48 ticket, so only `start:production` and
> `db:check:drift` were repointed here). Until that's fixed, run
> `node scripts/runtime/setup-contact-search-index.mjs` directly instead of
> `npm run search:setup-index`.

---

## Key environment variables for deploy

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Postgres connection string |
| `AUTH_SECRET` | Yes | NextAuth secret — generate with `npx auth secret` |
| `APP_URL` | Yes | Public origin, e.g. `https://kontax.vexon.co` |
| `CRON_SECRET` | Yes | LXC cron authenticates with this |
| `KONTAX_DEPLOY_ENV` | **Set on every app** | `production` in prod (→ `migrate`), `staging` on staging (→ `push`). Leaving it unset under `NODE_ENV=production` forces `migrate`, which crash-loops an environment whose migration history has not been baselined — see the one-time baseline step above |
| `KONTAX_SCHEMA_MODE` | Optional | Explicitly force `migrate`, `push`, `validate`, or `skip` |

See [env-secrets.md](env-secrets.md) for the full variable inventory.

---

## References

- Dockerfile: `Dockerfile`
- Startup policy: `scripts/runtime/start-production.mjs`
- Drift check: `scripts/runtime/check-schema-drift.mjs`
- Prisma schema: `prisma/schema.prisma`
- Memory: [Email/SES deployment](../memory/project_email-ses-deployment.md)
