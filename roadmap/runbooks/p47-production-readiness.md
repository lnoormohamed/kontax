# P47 Production Readiness — living checklist

Owner ticket: [P47-01](../build-phase/p47-01-production-readiness-checklist.md).
Seeded from the checklist in
[phase-47-preprod-release.md](../build-phase/phase-47-preprod-release.md),
then **verified live against the prod stack on 2026-07-05** (SSH to Proxmox
`192.168.1.33`, `pct exec` into each LXC, plus public curl probes).

Status legend: ✅ verified · ◑ exists but partial/unverified · ⬜ not started ·
⚠️ known blocker.

## Headline (2026-07-05 inspection)

Prod is further along than Phase 47 assumed. The app is **live at
`https://getkontax.com`** (deployed build = `origin/main` d638082, 2026-07-02),
boots clean in `production`/`validate` mode, MinIO env is wired, and **all cron
jobs return 200**. The biggest true gaps: Stripe test mode, missing
`REDIS_URL`/`MICROSOFT_*`/off-schema env, no DB backups, and the P38–P46 schema
(arrives when staging merges to main).

## Backing services (Workstream A)

| # | Service | Status | Verified by (2026-07-05) | Ticket |
|---|---------|--------|--------------------------|--------|
| 1 | **PostgreSQL** — LXC 129 · `192.168.1.193:5432` · db `kontax` | ✅ provisioned, reachable, app connects. Schema = **main-build era (49 tables)**; P38–P46 tables (`ContactBookMembership`, `ContactPrivateField`, `KontaxExportJob`…) absent until staging merges. 1 real user (owner account, 2026-06-17). Shared instance (~10 project DBs) | `psql` table count + key-table probe; app startup `[schema-check] Database schema matches` | P47-06 |
| 2 | **MinIO** — LXC 151 · `192.168.1.119:9000` · bucket `kontax-uploads` | ✅ **fully verified 2026-07-05**: env wired (`MINIO_ENDPOINT` now `https://media.getkontax.com`); **avatar round-trip green** — QA-user upload via `/api/upload/avatar` → two objects (canonical PNG + 96px webp thumb) → both load publicly over `media.getkontax.com` (200, correct content-types); **presigned export plane green** — `DataExportJob` processed to READY, `downloadUrl` signs the **public** host, 200 download from the internet, valid ZIP. Shared instance kept (bucket + scoped key) | live round-trip on prod | P47-02 |
| 3 | **Redis / Valkey** — LXC 143 `redis-rate-limit` | ✅ **live 2026-07-05**: `REDIS_URL` (logical DB 1, existing `requirepass`) set in Coolify via tinker + restart-only deploy; verified end-to-end — hitting `/api/register` produced `rl:registration:ip:*` in DB 1. Shared instance kept (`.30` = passportbase on DB 0, `.97` = 143 itself). ⚠️ **Follow-up found during verify:** the rate-limit key's IP is `192.168.1.124` (NPM) — Traefik doesn't trust NPM's `X-Forwarded-For`, so **all visitors share one bucket**; fix = `forwardedHeaders.trustedIPs=192.168.1.124` on the coolify-proxy entrypoints (affects all Coolify apps; brief proxy restart) | live key observed in DB 1 | P47-03 |
| 4 | **Cron** — LXC 152 `kontax-cron` | ✅ all 8 jobs + 15-min sync in `/etc/cron.d/kontax` with `APP_URL=https://getkontax.com`; **live probes `sync`, `birthday-reminders`, `reset-api-counters` → 200** (secret matches the app). Remaining: crontab-vs-route reconcile after the staging merge; observe a real sync pull+push | crontab read + curl with crontab secret | P47-04 |
| 5 | **App container env** — Coolify LXC 122 | ◑ far beyond P34D-era: `KONTAX_DEPLOY_ENV=production`, `KONTAX_SCHEMA_MODE=validate`, `TOTP_ENCRYPTION_KEY`, `CRON_SECRET`, all `MINIO_*`, Google OAuth (prod redirect), SES (`noreply@getkontax.com`, us-east-1), all `STRIPE_*` set. **Missing:** `REDIS_URL`, `MICROSOFT_*` (4), `NEXT_PUBLIC_PRICE_*` (6), `PHOTO_SYNC_ENABLED` + other off-schema vars (see P47-05 table). Extra var present: `SES_TO_EMAIL` (not in env.js) | `docker inspect` env dump (names + non-secret values) | P47-05 |
| 6 | **Schema apply policy** | ◑ **prepped 2026-07-05, apply staged for merge day** (see §P47-06 apply-day runbook below). Dry-run diff computed against prod: **100% additive** — 1 new enum + 2 enum values, 3 new tables (`ContactBookMembership`, `ContactPrivateField`, `KontaxExportJob`), nullable columns, one `NOT NULL DEFAULT false`, FKs + 7 indexes; **zero drops, zero required-no-default columns**. Artifact: [artifacts/p47-06-prod-schema-diff-2026-07-05.sql](artifacts/p47-06-prod-schema-diff-2026-07-05.sql). ⚠️ **Do NOT apply early**: the validator diffs DB→schema, so extra tables in the DB count as drift — the running main build would crash-loop on its next restart (the P40 incident, in reverse) | `prisma migrate diff --script` from local staging checkout against prod | P47-06 |

## External services (Workstream B)

| # | Service | Status | Verified by | Ticket |
|---|---------|--------|-------------|--------|
| 7 | **Google OAuth** | ◑ `GOOGLE_CLIENT_ID/SECRET` set with prod redirect `https://getkontax.com/api/sync/google/callback`. Unverified: console-side redirect registration, People-API sensitive-scope verification status (2–6 wk pole — confirm submitted) | app env dump | P47-07 |
| 8 | **Microsoft OAuth** | ⬜ no `MICROSOFT_*` env at all → Outlook connector hidden in prod | app env dump | P47-07 |
| 9 | **Stripe** | ⚠️ **still test mode** (`sk_test_…`); all six price IDs + webhook secret set (test-mode values). `NEXT_PUBLIC_PRICE_*` display strings missing | app env dump (key prefix) | P47-08 |
| 10 | **SES** | ◑ configured: `EMAIL_FROM=noreply@getkontax.com`, us-east-1, creds set. Unverified: sandbox status for the getkontax.com identity, DKIM/SPF, a live delivery. Note from-domain decided = **getkontax.com** (not vexon.co) | app env dump | P47-09 |

## Edge, domain & security (Workstream C)

| # | Item | Status | Verified by | Ticket |
|---|------|--------|-------------|--------|
| 11 | **DNS / edge routing** | ✅ `getkontax.com` 200 publicly. **Public path = Cloudflare → NPM LXC 111 (`192.168.1.124`), NOT Coolify Traefik** (Traefik 503s these hosts — phase doc assumption corrected). `media.getkontax.com` **fixed 2026-07-05**: was 522 (stale A record — hostname missing from cloudflare-ddns LXC 103 `DOMAINS`); added + restarted → record updated → health 200 public. `app.getkontax.com` has no DNS record → canonical origin = `getkontax.com` (ratify in P47-11). ⚠️ pre-existing ddns config debris: missing comma after `blog.lanway.dev` (swallows `next.lahn.uk`), `api.getkontax.com` is a CNAME so its A-record update errors every run | dig, curl, NPM conf, ddns journal | P47-10 |
| 12 | **TLS** | ✅ `getkontax.com` + `media.getkontax.com` valid via Cloudflare (`*.getkontax.com`, expires 2026-09-12); NPM holds a Let's Encrypt origin cert (`npm-109`) | curl -v handshake | P47-10 |
| 13 | **URL / host audit** | ⬜ not run (code-side; run against the merge candidate) | — | P47-11 |
| 14 | **Security headers / CSP** | ✅ live CSP already includes `img-src … https://media.getkontax.com`, plus HSTS/permissions-policy present | curl -I on live origin | P47-11 |

## Verify & cut over (Workstream D)

| # | Item | Status | Notes | Ticket |
|---|------|--------|-------|--------|
| 15 | **Backups** | ✅ **built + drilled 2026-07-05**: nightly 02:30 UTC cron on the Proxmox host (`/etc/cron.d/kontax-backup` → `/usr/local/bin/kontax-backup.sh`) dumps `kontax` (`pg_dump -Fc` via `runuser` — NOT `su -`, whose MOTD banner corrupts the stream) + tars the `kontax-uploads` bucket to NAS `/mnt/pve/pve-ugreen/backup/kontax/{db,minio}`, 14-day retention, size sanity check, log at `/var/log/kontax-backup.log`. **Restore drill passed**: dump → scratch DB → 49 tables + user row verified → dropped. Note: no Proxmox-wide vzdump schedule exists (`jobs.cfg` absent) — consider one for 122/129/151/152 separately | first run + restore drill | P47-12 |
| 16 | **Uptime monitoring** | ◑ Uptime Kuma runs (LXC 131) — confirm it watches `getkontax.com` + `media.` + cron, with alerting | not yet checked in Kuma UI | P47-12 |
| 17 | **Production smoke test** | ⬜ | after the staging merge + gaps above | P47-13 |
| 18 | **Go-live cutover** | ◑ app already serves prod traffic; "cutover" reduces to: merge staging→main, schema apply (P47-06), redeploy, admin bootstrap (owner account already exists — grant admin), post-swap smoke | — | P47-14 |
| 19 | **Post-launch review** | ⬜ | — | P47-14 |

## Open gap list (ordered — externals deliberately last per 2026-07-05 decision)

1. ~~Two Coolify env changes + redeploy~~ **DONE 2026-07-05** (set via Coolify
   tinker — model layer, values encrypted — + queued `restart_only` deploy):
   `REDIS_URL` → DB 1 verified live; `MINIO_ENDPOINT=https://media.getkontax.com`
   in the running container; clean `validate` boot; site 200. Caveat stands:
   server-side uploads hairpin through Cloudflare (~100 MB proxied body limit) —
   revisit with split-horizon DNS if export archives outgrow it. A `deploy`-scoped
   Coolify API token `claude-p47-deploy` now exists (instance API is disabled;
   deployments queued via tinker helper instead).
1b. **NEW — real client IP** (found while verifying Redis): edge chain is
   Cloudflare → NPM (.124) → **coolify-proxy Traefik** (`192.168.1.30:80`) → app.
   NPM sends correct `X-Forwarded-For`, but Traefik doesn't trust it → app sees
   `.124` for every visitor → **rate limits are one shared global bucket**.
   Fix: add `--entryPoints.http.forwardedHeaders.trustedIPs=192.168.1.124` (+
   https entrypoint) to `/data/coolify/proxy/docker-compose.yml` and restart
   coolify-proxy (seconds of downtime for ALL Coolify apps — schedule it).
   Longer term consider `CF-Connecting-IP` to resist XFF spoofing from
   direct-to-origin traffic.
2. ~~Avatar round-trip + export-download test~~ **DONE 2026-07-05** — QA
   account `p47qa@getkontax.com` (id `cmr7fczy60000mq4cex0ak6kl`, email
   force-verified via DB; keep for P47-13 smoke tests, rotate its password
   before launch). Avatar canonical+thumb public 200; data-export READY →
   public presigned download → valid ZIP. Export row expires via the
   `expire-exports` cron in 48 h — a free natural test of expiry.
3. **Schema apply for P38–P46** (P47-06) — gates the staging→main deploy; run
   backfills per ticket.
4. **Remaining env at merge time**: `MICROSOFT_*`, `NEXT_PUBLIC_PRICE_*` (build
   env), `PHOTO_SYNC_ENABLED` decision + off-schema vars (P47-05/07).
5. Confirm **Uptime Kuma** coverage of app + media + cron (P47-12 residual).
6. **SES sandbox/DKIM for getkontax.com** + a live send (P47-09).
7. **Externals last (user decision)**: Stripe live mode (P47-08) + Google
   People-API verification & Microsoft registration (P47-07) once everything
   else works.
8. Housekeeping: ~~ddns missing-comma bug~~ + ~~`api.getkontax.com` CNAME-vs-A
   noise~~ **both fixed 2026-07-05** (comma corrected, `api.` removed from the
   ddns list — it stays a CNAME → apex, so it follows the managed A record for
   free; clean run verified, `next.lahn.uk` updating again). Still open:
   identify Redis client `.97`, decide `SES_TO_EMAIL` (undocumented var), and
   note `https://api.getkontax.com/` currently 404s at the app layer (edge path
   works; decide whether that hostname has a purpose or should be retired).

## P47-06 apply-day runbook (execute with the staging→main deploy)

Prepped 2026-07-05. The apply MUST be choreographed with the deploy because the
`validate` boot diffs **DB → build schema** in both directions: applying early
makes the *old* build crash-loop on its next restart; deploying the new build
first makes *it* crash-loop on missing tables. Keep the window minutes-wide:

1. **Fresh snapshot** — `/usr/local/bin/kontax-backup.sh` on the Proxmox host
   (or a manual `pg_dump -Fc` via `runuser -u postgres`, never `su -` — its
   MOTD banner corrupts the stream).
2. **Re-run the diff** from the merge candidate checkout (schema may have moved
   since 2026-07-05):
   `DATABASE_URL=<prod> npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script`
   Confirm still additive-only. Prod DB is reachable from the dev machine
   (`192.168.1.193:5432`).
3. **Apply** — `DATABASE_URL=<prod> npm run db:push` (no `--accept-data-loss`,
   ever). Staging precedent: may need 2 attempts (P41 note).
4. **Backfills** (sized against live prod 2026-07-05 — 2 users, 0 contacts /
   books / sync accounts / groups):
   - `migrate-default-address-books.mjs` — **RUN** (creates the default book
     for the 2 pre-books users).
   - `backfill-contact-book-memberships.mjs` — run after it; no-op at 0
     contacts but validates wiring.
   - `backfill-avatar-thumbs.mjs`, `backfill-source-type.mjs`,
     `backfill-sync-account-{lineage,settings}.mjs` — **skip-empty** (0 rows;
     QA avatar already has its thumb).
   - `setup-contact-search-index.mjs` — already present in prod (validate boot
     confirms the trigger); re-run only if the drift check complains.
5. **Drift gate** — `DATABASE_URL=<prod> node scripts/check-schema-drift.mjs`
   → exit 0 (also verifies the search trigger).
6. **Deploy the merged build** (Coolify; queue via tinker helper if the UI is
   inconvenient — see Access notes) and watch the log for
   `Validating live schema before boot.` → `Starting Kontax.`; site 200.
7. **Record** the diff output + backfill run/skip decisions here.

Rollback: schema changes are additive, so the old code runs fine against the
new schema — but the old build's `validate` boot will **refuse to start** (it
sees the extra tables as drift). To roll back the app after the apply: redeploy
the old build with `KONTAX_SCHEMA_MODE=skip` set temporarily (extra tables are
harmless to old code), then remove the override once fixed forward. Do NOT set
`push` on the old build — it would try to make the DB match the old schema.
Snapshot from step 1 is the last resort.

## Access notes

- Proxmox: `ssh -i ~/.ssh/claude-proxmox-uk root@192.168.1.33`, then `pct exec <id>`.
- App container on 122: `l96ws6pb8cgh38st6bl20955-*` (Coolify UUID); env via
  `docker inspect`.
- ddns config: LXC 103 `/etc/systemd/system/cloudflare-ddns.service`
  (backup at `/root/cloudflare-ddns.service.bak-20260705`).
- Public reverse proxy: NPM LXC 111, `/data/nginx/proxy_host/49.conf`
  (`getkontax.com`+`api.`) and `50.conf` (`media.` → `192.168.1.119:9000`).
