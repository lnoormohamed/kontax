# Phase 47 — Pre-prod release: production infrastructure verification & go-live

## Overview

Phase 47 takes Kontax from the staging environment (`kontax.vexon.co`, homelab
`10.0.0.x`) to a **verified, complete production deployment** on `getkontax.com`.

The production stack was **partially stood up during the abandoned P34D pass**
(P34D-09 → P34D-11): the Proxmox host, Coolify, the database, a MinIO instance,
and a cron LXC all exist. But P34D never finished — the app still lives on
staging, Stripe is still in test mode, and the MinIO env was never wired into
the app (this is the same **P44-06 blocker**: photos pull + normalize but drop
because there's no storage binding). Meanwhile Phases 38–46 added whole new
infra surfaces that P34D never covered: **MinIO-backed contact photos**, the
**15-minute sync runner**, the **Redis/Valkey** rate-limit store, **export-job
artifacts**, and the **multi-book schema (P40)**.

So this phase is **not a greenfield build** — it is a *verify-what-exists,
close-the-gaps, then cut over* phase. The centre of gravity is the
**Production Readiness Checklist** below: a service-by-service inventory with an
honest current status. Every ⬜/◑ line is owned by a ticket.

> This phase supersedes and completes the infrastructure workstreams of
> **P34D** (P34D-09 → P34D-23) for the current, larger app. The P34D smoke-test
> workstream is reused, not rewritten (see P47-13).

### Workstream A — Infrastructure verify & gap-close (P47-01 → P47-06)
The checklist core. Walk every backing service (DB, MinIO, Redis, cron, env,
schema) and prove it is provisioned, wired into the app env, and reachable
from where it needs to be reachable (browser vs container).

### Workstream B — External service registrations for the prod origin (P47-07 → P47-09)
OAuth redirect URIs, Stripe **live mode**, and SES **production sending** — the
third-party accounts that must be re-pointed from staging/sandbox to
`getkontax.com`. Google's People-API sensitive-scope verification is the
**longest external pole** (2–6 weeks); it starts on day one.

### Workstream C — Edge, domain & security (P47-10 → P47-11)
DNS / Cloudflare / Traefik routes and TLS for `getkontax.com` + `media.getkontax.com`,
then a URL/host audit (reconcile `app.getkontax.com` vs `getkontax.com`, purge
baked `10.0.0.x` homelab URLs) and CSP/security-header parity.

### Workstream D — Verify & cut over (P47-12 → P47-14)
Backups + uptime monitoring, the full production smoke-test matrix, then the
sequential go-live runbook and a 24-hour post-launch review.

---

## Production Readiness Checklist

Status legend: ✅ done · ◑ exists but unverified / not wired · ⬜ not started ·
⚠️ known blocker.

> **2026-07-05 live inspection:** the stack was walked service-by-service over
> SSH (statuses below updated to match). Full verified detail + open-gap list:
> [../runbooks/p47-production-readiness.md](../runbooks/p47-production-readiness.md).
> Headline corrections: the app is **already live on `getkontax.com`** (main
> build d638082, clean `validate` boot), cron is fully green (all endpoints
> 200), MinIO env **is** wired, and the public edge is **Cloudflare → NPM
> (LXC 111)** — not Coolify Traefik as assumed below. `media.getkontax.com`'s
> 522 (stale A record — hostname missing from the cloudflare-ddns list) was
> fixed during the inspection; it now serves 200 publicly.

### Backing services (Workstream A)

| # | Service | Where | Current status | Ticket |
|---|---------|-------|----------------|--------|
| 1 | **PostgreSQL** | LXC 129 · `192.168.1.193:5432` · db `kontax` | ✅ provisioned + app connects; schema **matches the deployed main build** (49 tables, verified 2026-07-05) but is **missing all P38–P46 additive tables/columns** (`ContactBookMembership`, `ContactPrivateField`, `KontaxExportJob`, photo/sharing/notification-aging columns…) — apply lands with the staging merge. 1 real user (owner). Shared instance (~10 project DBs) | P47-06 |
| 2 | **MinIO blob storage** | LXC 151 · `192.168.1.119:9000` · bucket `kontax-uploads` · proxied `https://media.getkontax.com` | ✅ **fully verified 2026-07-05**: env wired, `MINIO_ENDPOINT` re-pointed to the public media host, live avatar round-trip (canonical + thumb, public 200) AND presigned export download (public host in signature, valid ZIP) both green on prod. Shared instance kept by decision | P47-02 |
| 3 | **Redis / Valkey** (rate limiting) | LXC 143 `redis-rate-limit` (shared, near-idle) | ◑ instance exists and healthy, but **`REDIS_URL` not set in the app env** → app on the in-memory fallback (not prod-safe: limits reset per restart). Plan: shared instance, Kontax logical DB/prefix, enable auth | P47-03 |
| 4 | **Cron / scheduler** | LXC 152 `kontax-cron` → `getkontax.com/api/cron/*` | ✅ 8 jobs + 15-min sync installed **and verified live 2026-07-05**: probed endpoints return 200 with the crontab secret (`CRON_SECRET` matches). Remaining: route reconcile after staging merge + observe a real sync pull+push | P47-04 |
| 5 | **App container env** | Coolify LXC 122 | ◑ far beyond P34D-era (verified 2026-07-05): deploy-env/TOTP/cron/MinIO/Google/SES/Stripe all set. **Missing:** `REDIS_URL`, `MICROSOFT_*`, `NEXT_PUBLIC_PRICE_*`, **plus the off-schema vars `env.js` misses** (`PHOTO_SYNC_ENABLED` launch decision, admin capability overrides, sync/session tuning knobs) | P47-05 |
| 6 | **Schema apply policy** | Coolify LXC 122 | ✅ **DONE 2026-07-05**: staging merged to main (`3c917d5`), P38–P46 schema applied additively (49→52 tables), backfills run, drift gate exit 0, new build live on `validate` with clean boot | P47-06 |

### External services (Workstream B)

| # | Service | Current status | Ticket |
|---|---------|----------------|--------|
| 7 | **Google OAuth** (Contacts sync) | ◑ env set with prod redirect `getkontax.com/api/sync/google/callback` (verified 2026-07-05); confirm console-side registration + **People-API sensitive-scope verification = 2–6 wk external pole — start now** | P47-07 |
| 8 | **Microsoft OAuth** (Outlook sync) | ⬜ no `MICROSOFT_*` env in prod at all (connector hidden); Azure registration + redirect URI needed | P47-07 |
| 9 | **Stripe** | ⚠️ still **test mode** (`sk_test_` verified 2026-07-05) — needs live keys, live webhook endpoint + secret, live price IDs, customer-portal config; `NEXT_PUBLIC_PRICE_*` display strings also unset | P47-08 |
| 10 | **Amazon SES** | ◑ prod env uses `EMAIL_FROM=noreply@getkontax.com` (us-east-1) — from-domain **decided: getkontax.com**; confirm identity verified + **out of sandbox**, DKIM/SPF, a live send | P47-09 |

### Edge, domain & security (Workstream C)

| # | Item | Current status | Ticket |
|---|------|----------------|--------|
| 11 | **DNS / Cloudflare / edge** | ✅ `getkontax.com` live (200); **public path = Cloudflare → NPM LXC 111, not Traefik**. `media.getkontax.com` 522 **fixed 2026-07-05** (hostname was missing from the cloudflare-ddns list → stale A record; now 200 publicly). `app.getkontax.com` has no DNS record → canonical origin = `getkontax.com` (ratify in P47-11) | P47-10 |
| 12 | **TLS end-to-end** | ✅ `getkontax.com` + `media.getkontax.com` valid (`*.getkontax.com` via Cloudflare, exp 2026-09-12; LE origin cert on NPM); mixed-content sweep still due with P47-13 | P47-10 |
| 13 | **URL / host audit** | ✅ **run 2026-07-05**: shipped code + prod DB clean of staging/homelab hosts; canonical origin = `getkontax.com` (+ `api.` REST rewrite host, `media.` objects); one cosmetic homepage-mockup fix on staging (f7858a9) | P47-11 |
| 14 | **Security headers / CSP** | ✅ live CSP already includes `img-src … https://media.getkontax.com`; HSTS + permissions-policy present (verified 2026-07-05); re-verify after staging merge | P47-11 |

### Verify & cut over (Workstream D)

| # | Item | Ticket |
|---|------|--------|
| 15 | **Backups** — ✅ built + restore-drilled 2026-07-05 (nightly host cron → NAS, 14-day retention; see readiness runbook) | P47-12 |
| 16 | **Uptime monitoring** — external checks + alerting on app, media, cron | P47-12 |
| 17 | **Production smoke test** — full matrix on the live origin | P47-13 |
| 18 | **Go-live cutover** — sequential runbook incl. **founding-admin bootstrap** (empty prod DB has no admin; `scripts/grant-admin.mjs`) | P47-14 |
| 19 | **Post-launch review** — 24 h after cutover | P47-14 |

---

## Tickets

| Ticket | Title | Workstream | Priority | Depends on |
| --- | --- | --- | --- | --- |
| [P47-01](p47-01-production-readiness-checklist.md) | Production readiness master checklist & service inventory | A | P0 | — |
| [P47-02](p47-02-minio-media-host-verification.md) | MinIO / media host verification & avatar round-trip | A | P0 | P47-01 |
| [P47-03](p47-03-redis-valkey-rate-limit-store.md) | Redis/Valkey rate-limit store verify/provision | A | P1 | P47-01 |
| [P47-04](p47-04-cron-lxc-sync-runner-verification.md) | Cron LXC + sync-runner verification | A | P1 | P47-01, P47-05 |
| [P47-05](p47-05-production-env-var-completeness.md) | Production env-var completeness & validation | A | P0 | P47-01 |
| [P47-06](p47-06-production-schema-apply.md) | Production schema apply & drift-free boot | A | P0 | P47-01 |
| [P47-07](p47-07-oauth-redirect-uris-prod.md) | OAuth redirect URIs — Google (+ People-API verification) & Microsoft | B | P1 | — |
| [P47-08](p47-08-stripe-live-mode-switch.md) | Stripe live-mode switch (keys, webhook, prices, portal) | B | P0 | — |
| [P47-09](p47-09-ses-production-sending.md) | SES production sending (sandbox exit, from-domain) | B | P1 | — |
| [P47-10](p47-10-dns-traefik-tls.md) | DNS / Cloudflare / Traefik routes + TLS end-to-end | C | P0 | — |
| [P47-11](p47-11-url-host-audit-security-headers.md) | URL/host audit + security headers / CSP media parity | C | P0 | P47-10 |
| [P47-12](p47-12-backups-uptime-monitoring.md) | Backups (DB + MinIO) & uptime monitoring | D | P1 | P47-06 |
| [P47-13](p47-13-production-smoke-test-matrix.md) | Production smoke-test matrix | D | P0 | P47-02…11 |
| [P47-14](p47-14-go-live-cutover-and-post-launch.md) | Go-live cutover runbook & 24 h post-launch review | D | P0 | P47-13 |

---

## Definition of Done for Phase 47

- [ ] Master checklist (P47-01) recorded in a runbook; every line ✅ or explicitly deferred with reason
- [ ] MinIO wired + a real avatar round-trips over `https://media.getkontax.com` — no `/api/image-proxy` fallback; an export-job artifact downloads via its presigned URL from a browser (P47-02)
- [ ] `REDIS_URL` set and rate limits shared across restarts (P47-03)
- [ ] All 8 cron jobs return 200 with the live `CRON_SECRET`; a real sync run completes (P47-04)
- [ ] Full `src/env.js` inventory **plus off-schema vars** set in Coolify incl. `KONTAX_DEPLOY_ENV=production`, `TOTP_ENCRYPTION_KEY`; `PHOTO_SYNC_ENABLED` launch decision recorded (P47-05)
- [ ] All P38–P46 schema applied additively; app boots clean in `validate` mode, `check-schema-drift.mjs` → exit 0 (P47-06)
- [ ] Google + Microsoft redirect URIs live for the prod origin; Google verification submitted (P47-07)
- [ ] Stripe live keys + live webhook verified end-to-end (P47-08)
- [ ] SES confirmed out of sandbox; from-domain decided; a live email delivers (P47-09)
- [ ] DNS/Traefik routes + valid TLS on every live hostname; one canonical app origin (P47-10, P47-11)
- [ ] Zero baked staging/homelab URLs; CSP `img-src` allows the prod media host (P47-11)
- [ ] Nightly DB backup + restore drill passed; uptime monitoring alerting (P47-12)
- [ ] Production smoke test signed off — all P0 failures closed (P47-13)
- [ ] Go-live cutover completed incl. founding-admin bootstrap (`scripts/grant-admin.mjs`); post-launch review written (P47-14)

---

## Environment reference (verified 2026-07-05 from infra memory)

| Setting | Staging | Production |
|---------|---------|-----------|
| Proxmox host | `10.0.0.10` | `192.168.1.33` |
| App / Coolify | LXC 114 | LXC 122 |
| Domain | `kontax.vexon.co` | `getkontax.com` (app origin TBD — see P47-11) |
| Database | `10.0.0.200` | LXC 129 · `192.168.1.193:5432` · db `kontax` |
| MinIO | staging instance | LXC 151 · `192.168.1.119:9000` · bucket `kontax-uploads` |
| Media host (browser) | `https://media-staging.getkontax.com` | `https://media.getkontax.com` |
| Cron | — | LXC 152 `kontax-cron` → `getkontax.com/api/cron/*` |
| `KONTAX_DEPLOY_ENV` | `staging` (→ `push`) | `production` (→ `validate`) |
| Stripe mode | test | **live** (P47-08) |
| Edge | — | Cloudflare (proxied) → **Nginx Proxy Manager LXC 111** (`192.168.1.124`; Coolify Traefik is NOT in the public path — verified 2026-07-05) |
| Public entry configs | — | NPM `proxy_host/49.conf` (app+api) · `50.conf` (media → MinIO) · ddns LXC 103 |

---

## References

- Deploy & schema policy: [../runbooks/deploy.md](../runbooks/deploy.md)
- Env inventory & rotation: [../runbooks/env-secrets.md](../runbooks/env-secrets.md)
- SES setup: [../runbooks/ses-setup.md](../runbooks/ses-setup.md)
- Stripe billing: [../runbooks/stripe-billing.md](../runbooks/stripe-billing.md)
- DB restore: [../runbooks/db-restore.md](../runbooks/db-restore.md)
- Full smoke test: [../runbooks/full-smoke-test-and-field-edit-audit.md](../runbooks/full-smoke-test-and-field-edit-audit.md)
- Prior go-live phase (superseded infra workstreams): [phase-34d.md](phase-34d.md)
</content>
</invoke>
