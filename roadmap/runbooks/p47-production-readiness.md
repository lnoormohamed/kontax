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
| 5 | **App container env** — Coolify LXC 122 | ✅ **complete 2026-07-05** — no unintended degraded mode. All hard-required + service-group vars set and verified (`MINIO_*`, `REDIS_URL`, SES, Google OAuth, Stripe-test, `TOTP_ENCRYPTION_KEY`, `CRON_SECRET`, `KONTAX_DEPLOY_ENV=production`). **Decisions ratified:** `MICROSOFT_*` parked; `NEXT_PUBLIC_PRICE_*` not needed (prices render from Stripe catalog); **the four off-schema tuning vars (`ADMIN_CAPABILITY_OVERRIDES`, `ADMIN_DEFAULT_TIER`, `SESSION_VALIDATION_CACHE`, `SYNC_COMMIT_TX_TIMEOUT_MS`) correctly left UNSET** — code defaults are optimal for prod's LAN topology + bootstrap-admin governance; mirroring staging would be wrong (see analysis below). **`PHOTO_SYNC_ENABLED` decision: launch WITH it ON** — set to `1` only once the P44-06 remaining rows pass on prod (row 7 echo-blocker already green on all 3 providers from staging). Extra var present: `SES_TO_EMAIL` (not in env.js — harmless) | `docker inspect` env dump + code-default analysis | P47-05 |
| 6 | **Schema apply** | ✅ **EXECUTED 2026-07-05** with the staging→main merge (`3c917d5`, 52 commits — the P38–P47 feature train). Ran per the apply-day runbook below: fresh snapshot → additive-only diff confirmed ([artifact](artifacts/p47-06-prod-schema-diff-2026-07-05.sql)) → `db push` (49→52 tables) → backfills (`migrate-default-address-books` created 2 books; memberships no-op at 0 contacts; rest skip-empty) → **drift gate exit 0** → auto-deploy on push → new build boots clean in `validate` (`Starting Kontax.`), site 200, `/format/*` artifacts 200, authed /contacts 200, pre-deploy session survived. Note: DB link from the dev machine is flaky (VPN) — scripts may need one retry | full apply + live verification | P47-06 |

## External services (Workstream B)

| # | Service | Status | Verified by | Ticket |
|---|---------|--------|-------------|--------|
| 7 | **Google OAuth** | ◑ `GOOGLE_CLIENT_ID/SECRET` set with prod redirect `https://getkontax.com/api/sync/google/callback`. Unverified: console-side redirect registration, People-API sensitive-scope verification status (2–6 wk pole — confirm submitted) | app env dump | P47-07 |
| 8 | **Microsoft OAuth** | **PARKED (user decision 2026-07-05)** — Outlook sync is a post-launch feature, not a launch item. No `MICROSOFT_*` env set → connector correctly hidden in prod. Azure registration moves to a future rollout ticket | app env dump | P47-07 (descoped) |
| 9 | **Stripe** | ⚠️ **still test mode** (`sk_test_…`); all six price IDs + webhook secret set (test-mode values). `NEXT_PUBLIC_PRICE_*` display strings missing | app env dump (key prefix) | P47-08 |
| 10 | **SES** | ✅ **verified 2026-07-05 via SES API** (SigV4 GetAccount with the app's creds): **ProductionAccessEnabled=true** (out of sandbox), SendingEnabled, 50k/day quota; `getkontax.com` identity VerifiedForSending + **DKIM SUCCESS**; a live app-path send (registration email) went out with no error and shows in the 24 h send count. From-domain = getkontax.com. Optional hardening, non-blocking: no SPF TXT on the root domain and DMARC is `p=none` — DKIM alignment carries DMARC today; consider SPF + custom MAIL FROM + `p=quarantine` later | SES API + live send | P47-09 |

## Edge, domain & security (Workstream C)

| # | Item | Status | Verified by | Ticket |
|---|------|--------|-------------|--------|
| 11 | **DNS / edge routing** | ✅ `getkontax.com` 200 publicly. **Public path = Cloudflare → NPM LXC 111 (`192.168.1.124`), NOT Coolify Traefik** (Traefik 503s these hosts — phase doc assumption corrected). `media.getkontax.com` **fixed 2026-07-05**: was 522 (stale A record — hostname missing from cloudflare-ddns LXC 103 `DOMAINS`); added + restarted → record updated → health 200 public. `app.getkontax.com` has no DNS record → canonical origin = `getkontax.com` (ratify in P47-11). ⚠️ pre-existing ddns config debris: missing comma after `blog.lanway.dev` (swallows `next.lahn.uk`), `api.getkontax.com` is a CNAME so its A-record update errors every run | dig, curl, NPM conf, ddns journal | P47-10 |
| 12 | **TLS** | ✅ `getkontax.com` + `media.getkontax.com` valid via Cloudflare (`*.getkontax.com`, expires 2026-09-12); NPM holds a Let's Encrypt origin cert (`npm-109`) | curl -v handshake | P47-10 |
| 13 | **URL / host audit** | ✅ **run 2026-07-05 against the deployed train**: zero `kontax.vexon.co` / `10.0.0.x` / `192.168.x` / `media-staging` refs in shipped code (`src`, `prisma`, `public`, configs); zero avatar URLs stored in the prod DB (nothing to rewrite); canonical origin ratified = **`getkontax.com`** with `api.getkontax.com` as the REST rewrite host (middleware maps `api./v1/*` → `/api/v1/*`; live probe 401 = working — "purpose TBD" resolved) and `media.` for objects. One cosmetic fix: homepage browser-chrome mockup displayed `app.getkontax.com` → now `getkontax.com` (f7858a9 on staging, SSR-verified; ships next merge) | grep sweep + DB query + live probes | P47-11 |
| 14 | **Security headers / CSP** | ✅ re-verified on the **new build** 2026-07-05: CSP (`img-src` incl. media host, `upgrade-insecure-requests`), HSTS `max-age=63072000; includeSubDomains; preload`, `X-Frame-Options: DENY`, `nosniff`, referrer-policy, permissions-policy — all present | curl -I on live origin | P47-11 |

## Verify & cut over (Workstream D)

| # | Item | Status | Notes | Ticket |
|---|------|--------|-------|--------|
| 15 | **Backups** | ✅ **built + drilled 2026-07-05**: nightly 02:30 UTC cron on the Proxmox host (`/etc/cron.d/kontax-backup` → `/usr/local/bin/kontax-backup.sh`) dumps `kontax` (`pg_dump -Fc` via `runuser` — NOT `su -`, whose MOTD banner corrupts the stream) + tars the `kontax-uploads` bucket to NAS `/mnt/pve/pve-ugreen/backup/kontax/{db,minio}`, 14-day retention, size sanity check, log at `/var/log/kontax-backup.log`. **Restore drill passed**: dump → scratch DB → 49 tables + user row verified → dropped. Note: no Proxmox-wide vzdump schedule exists (`jobs.cfg` absent) — consider one for 122/129/151/152 separately | first run + restore drill | P47-12 |
| 16 | **Uptime monitoring** | ◑ **2026-07-07**: Uptime Kuma (LXC 131, systemd `uptime-kuma.service`, SQLite `/opt/uptime-kuma/data/kuma.db`). App already monitored (id 14 `getkontax.com/api/health`, 300s/3-retry). **Added id 17 `Kontax Media (MinIO)` → `media.getkontax.com/minio/health/live`** (cloned id 14's config; verified UP 200/279ms; DB backup `kuma.db.bak-p47-20260707`). **Two gaps remain, both need input:** (a) **cron** — no public GET health (routes need `CRON_SECRET`+POST); proper fix = a Kuma **Push** monitor with each cron job heartbeating Kuma (edits LXC 152 crontab); (b) **NO alerting configured at all** (zero notification providers in Kuma — every monitor is dashboard-only) → needs a channel choice + creds (email via SES / Telegram / Discord webhook) | Kuma SQLite inspect + monitor add | P47-12 |
| 17 | **Production smoke test** | ◑ **scripted pass GREEN 2026-07-05** — full results in [smoke-test-results-p47.md](smoke-test-results-p47.md): auth, contacts CRUD+search via REST v1, avatar plane, P45 archive export → public presigned download → **open-format validator VALID ✓**, public card, API rate limits in Redis, cron re-verified on the new build. **Zero P0 failures.** Remaining for sign-off: manual/device items (2FA, mobile gestures, sharing flow, import wizard, notification visuals) + overnight-cron check | scripted battery on live origin | P47-13 |
| 18 | **Go-live cutover** | ◑ mostly done — prod already serves getkontax.com; merge+schema+redeploy ✅, post-swap scripted smoke ✅. **Admin bootstrap DONE 2026-07-07**: `li@linoormohamed.com` granted ADMIN (`grant-admin.mjs`) — sole admin + earliest user ⇒ GOVERNANCE bootstrap tier; `/admin` verified 200 (tested via temp-promote of p47qa, then revoked). **Remaining:** (a) decide `kontax.vexon.co` redirect — 301→prod (retire staging) vs leave as-is (staging on 10.0.0.x, currently unreachable); (b) at real launch, clean up QA fixtures — delete/repurpose `p47qa` user + `/u/p47qa` username, revoke ApiToken `p47-smoke`; both gated on finishing the manual smoke + photo QA that still use them | admin grant + `/admin` 200 | P47-14 |
| 19 | **Post-launch review** | ⬜ gated — write `p47-post-launch-review.md` at T+24h **after the actual launch** (which is itself gated on P47-13 manual sign-off + Stripe live + Google submit). Premature until then | — | P47-14 |

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
3. ~~Schema apply for P38–P46~~ **DONE 2026-07-05** — merged + applied +
   deployed; see checklist row 6.
4. ~~Remaining env~~ **RESOLVED 2026-07-05 — nothing left to set**:
   - `NEXT_PUBLIC_PRICE_*` — **not needed**: the live pricing page renders
     prices dynamically from the Stripe API (`src/server/stripe-catalog.ts`,
     currently showing the test products $2.99/$3.99); the only consumer of
     these vars is `pricing-comparison.tsx`, which is **dead code** (imported
     nowhere). Prices auto-update when P47-08 flips to live keys.
   - `MICROSOFT_*` — parked (post-launch feature, user decision 2026-07-05).
   - Off-schema tuning vars (`ADMIN_CAPABILITY_OVERRIDES`, `ADMIN_DEFAULT_TIER`,
     `SESSION_VALIDATION_CACHE`, `SYNC_COMMIT_TX_TIMEOUT_MS`) — **left unset by
     design.** Code-default analysis (2026-07-05): admin tier defaults to
     least-privilege `SUPPORT_OPS` with the bootstrap admin auto-`GOVERNANCE`;
     session-validation cache is now ON (Redis present); the tx-timeout 120s
     default suits prod's same-LAN DB (the override exists only for high-latency
     dev/staging-over-VPN). Prod must NOT mirror staging here — admin overrides
     are per-deployment, the knobs are topology-specific. Live staging-env diff
     couldn't run (10.0.0.x unreachable) but is unnecessary given the semantics.
   - `PHOTO_SYNC_ENABLED` — **launch decision: ON** (user, 2026-07-05). Set to
     `1` only after the P44-06 remaining matrix rows pass **on prod** (row 7
     echo-blocker already green on all 3 providers from the staging run). Until
     then it stays absent (=off). Tracked as the P44-06 prod completion below.
5. **P44-06 photo-sync QA on prod** → then flip `PHOTO_SYNC_ENABLED=1` (see the
   dedicated runbook section below). Gates the launch-with-photo-sync-on decision.
6. Confirm **Uptime Kuma** coverage of app + media + cron (P47-12 residual).
7. **SES sandbox/DKIM for getkontax.com** + a live send (P47-09) — ✅ done.
8. **Externals last (user decision)**: Stripe live mode (P47-08) + Google
   People-API verification & Microsoft registration (P47-07) once everything
   else works.
8. Housekeeping: ~~ddns missing-comma bug~~ + ~~`api.getkontax.com` CNAME-vs-A
   noise~~ **both fixed 2026-07-05** (comma corrected, `api.` removed from the
   ddns list — it stays a CNAME → apex, so it follows the managed A record for
   free; clean run verified, `next.lahn.uk` updating again). Still open:
   ~~identify Redis client `.97`~~ (= LXC 143 itself), decide `SES_TO_EMAIL`
   (undocumented var), and ~~api.getkontax.com purpose~~ **resolved**: it's the
   REST API rewrite host (`middleware.ts` maps `api./v1/*` → `/api/v1/*`;
   root 404 is expected).

## P44-06 photo-sync prod QA (gates PHOTO_SYNC_ENABLED=1)

Decision 2026-07-05: **launch with photo sync ON**, but only after the P44-06
matrix is completed on **prod**. Current state (from the staging run, see
`roadmap/build-phase/p44-06-photo-sync-qa-matrix.md`): the phase-exit blocker
**row 7 (echo double-cycle / no-loop) is GREEN on all 3 providers** (Fastmail,
iCloud, Google) and inbound pull (row 1) verified; the P47-02 MinIO-drop bug
that broke every earlier attempt is fixed on prod. What's left is re-confirming
on prod + the un-exercised rows.

**Prereqs (Li — interactive, can't be scripted):**
1. On prod (`getkontax.com`), log in as the QA account (`p47qa@getkontax.com`)
   or a dedicated photo-QA user.
2. Connect provider **test** accounts via the in-app OAuth/app-password flow:
   Google Contacts (OAuth is live on prod) + at least one CardDAV
   (Fastmail/iCloud app-password). Use throwaway/test accounts only.
3. Seed a few contacts prefixed `P44QA ` with photos (in-app avatar upload or
   the P44-01 harness).

**Then (Claude, once VPN is up + accounts connected):**
4. Set `PHOTO_SYNC_ENABLED=1` in Coolify (same tinker+restart path as `REDIS_URL`).
5. Drive sync via the product path (`/api/cron/sync` with `CRON_SECRET`, or
   `/api/sync/run`); confirm row 7 echo-quiet on prod + exercise the un-run rows
   (2,4–6,8–13: local push, change/delete both ways, conflict pick, same-image
   auto-resolve, Photos-exclusion, >1MB, cost). Watch for the known ops traps:
   Cloudflare 502 at ~30s on long first syncs (runner continues — poll `SyncJob`),
   Google `GOOGLE_QUOTA_EXCEEDED` looks frozen for ~10 min, stale `RUNNING` jobs
   block their account queue.
6. Record results in the P44-06 matrix; **leave `PHOTO_SYNC_ENABLED=1`** once green
   (this is the launch state). Clean up `P44QA ` contacts on every provider.

Rollback: unset `PHOTO_SYNC_ENABLED` (or set `0`) + restart — the pipes go dormant,
no data loss; existing stored avatars remain.

## P47-06 apply-day runbook (execute with the staging→main deploy)

> ✅ **`CharRomanization` APPLIED + DEPLOYED 2026-07-07.** The second apply ran
> per this runbook: snapshot → additive diff (1 stmt, `CREATE TABLE
> CharRomanization`, 0 drops) → `db push` → `seed:sort-romanization` (33,948
> rows, 李→li verified) → drift gate exit 0 → push main (`5fa6b51`) → auto-deploy.
> **The first auto-deploy FAILED** (build died at Next "Collecting page data",
> exit 255) — a transient build failure (local build of the same commit was
> clean; no OOM/disk); **retrying the deploy succeeded**. New container boots
> clean in `validate`; site 200. Reverse-drift window (DB ahead of old container
> between apply and successful deploy) is closed. Lesson: a failed Coolify build
> after a prod schema apply leaves the *old* container unable to restart safely —
> get the matching build deployed promptly (retry) rather than leaving it.

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
   - `seed:sort-romanization` — **RUN when the diff includes `CharRomanization`**
     (`DATABASE_URL=<prod> npm run seed:sort-romanization`); seeds the character
     lookup so non-Latin names sort/bucket by romanized initial. Data seed, not
     schema — safe to re-run (idempotent upsert).
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
