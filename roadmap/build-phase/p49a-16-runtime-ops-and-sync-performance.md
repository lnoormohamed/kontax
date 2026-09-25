# P49A-16 — Runtime & ops: Dockerfile, timeouts, health split, DAV/sync perf, export blobs

**Phase:** 49A · **Priority:** P1 · **Depends on:** P49A-04 · **Effort:** M
**Audit IDs:** A-29 (see P49A-13), A-30, A-38, A-39, A-40, A-41, A-42

## Objective
Predictable deploys and images, no single slow provider or DB blip taking the site down, and
CardDAV/sync costs proportional to what changed.

## Production verification (2026-09-25)
- A-40: the staging Coolify host hit 100 % disk during the `npm prune` + `npm install prisma@…`
  Dockerfile step on 2026-09-25 (freed 8 GB of build cache to recover). Dockerfile installs
  `prisma@<range>` after pruning (not lockfile-pinned) and `chown -R` duplicates `/app`.
- A-30: no MinIO object deletion exists for exports in origin/main (0 files call a delete in
  `data-export` or cron); prod has 1 EXPIRED export from 2026-07-05 whose object is likely still
  stored — contradicts `import-export-jobs.md` and GDPR erasure. Verify the object on MinIO when
  this ticket starts.
- A-38/A-39/A-41/A-42: code-verified (identical to prod). Prod `/api/health` returns 503 when the
  DB is down and validate-mode refuses to boot without a DB.

## Steps
1. Dockerfile: separate `npm ci --omit=dev` runtime stage, `prisma` in `dependencies`,
   `COPY --chown=node:node`, consider `output: "standalone"`; add a Docker build job to CI.
   Enable Coolify's Docker cleanup on both hosts.
2. Timeouts (overall deadline, not idle-only) on every Microsoft Graph, Google and photo fetch;
   bounded concurrency (4–8) for birthday-reminder and digest crons; cron overlap locks.
3. Health: `/api/health/live` (process up) for the container check; `/api/health` (DB/Redis) for
   readiness/monitoring.
4. CardDAV client: ctag/sync-token short-circuit; ETag-only listing + batched multiget.
   DAV server: select only `syncUid/syncVersion` for PROPFIND; `syncUid IN (…)` for multiget;
   index for the ctag query.
5. Exports: delete MinIO objects on expiry and on account hard-delete; one-off cleanup of
   existing expired objects.
6. Error reporting: add Sentry (or OTel) via `instrumentation.ts`; structured logs.

## Acceptance
- Image size reported in CI and < current; `node_modules/typescript` absent from the runtime image.
- A mocked hanging Graph call fails the job within the deadline, next job proceeds.
- Container stays healthy during a 30 s DB outage; readiness reports degraded.
- Expired export object is gone from MinIO after the cron.
