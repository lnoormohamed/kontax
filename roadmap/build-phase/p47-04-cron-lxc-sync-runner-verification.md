# P47-04 — Cron LXC + sync-runner verification

**Phase:** 47 · **Workstream:** A · **Priority:** P1 · **Depends on:** P47-01, P47-05

## Objective

Prove every scheduled job runs against the **live** app, authenticated with the
production `CRON_SECRET`, and that the **15-minute sync runner** actually pulls
and pushes. Existence of the crontab is not the same as the jobs succeeding.

## Context

LXC 152 `kontax-cron` (Debian 12, `/etc/cron.d/kontax`) already targets
`https://getkontax.com/api/cron/*` and runs sync every 15 min. Each call sends
the `x-cron-secret` header; the value **must match** `CRON_SECRET` in the app
env or every job 401s. This wiring was never verified end-to-end against the
current app.

## The jobs (per infra memory + env-secrets §Cron)

| Endpoint | Schedule |
|----------|----------|
| `/api/cron/reset-api-counters` | daily 00:00 UTC |
| `/api/cron/delete-accounts` | daily 01:00 UTC |
| `/api/cron/expire-exports` | daily 01:15 UTC |
| `/api/cron/data-export` | daily 01:30 UTC |
| `/api/cron/cleanup-card-views` | daily 02:00 UTC |
| `/api/cron/birthday-reminders` | daily 08:00 UTC |
| `/api/cron/digest` | daily 08:00 UTC |
| **sync runner** | every 15 min |

> Cross-check `env-secrets.md` lists these plus `data-export`/`expire-exports`
> and note any endpoint that exists in code but is **not** in the crontab (e.g.
> a P45 export-expiry or P46 notification-aging sweep) — a job in code with no
> scheduler entry never runs. Reconcile the crontab against the actual
> `/api/cron/*` route list before sign-off.

## Steps

1. **Secret match** — confirm `CRON_SECRET` in Coolify (P47-05) equals the value
   the crontab sends. Generate a fresh one if unknown (`openssl rand -hex 32`),
   update **both** the crontab and Coolify (env-secrets §Cron).
2. **Manual 200 check** — from LXC 152, `curl` each endpoint with the header;
   expect 200, not 401/404. Record any 404 (missing route or wrong path).
3. **Reconcile** — diff the crontab against the live `/api/cron/*` route list;
   add any missing schedule (esp. anything Phases 45–46 introduced).
4. **Sync run** — trigger a real sync for a test connection; confirm a
   pull+push completes and sync-window/deletion-safety enforcement (P39) fires
   as configured. (Photo sync verified in P47-02.)
5. **Timezone sanity** — confirm the DST-safe window logic (P39-01) behaves at
   the prod server's clock.

## Acceptance

- Every cron endpoint returns 200 with the live secret; none 401/404.
- The crontab covers every schedulable `/api/cron/*` route — no orphans.
- A real sync run completes on prod (pull + push observed in activity log).
- Recorded on the P47-01 checklist.

## References

- env-secrets §Cron jobs · Infra memory §Cron jobs
- Phase 39 (runner enforcement), Phase 44 (photo sync)
</content>
