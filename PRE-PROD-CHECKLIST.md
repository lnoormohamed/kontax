# Pre-production checklist

Operational / infra items deferred until we go to prod. These are **not code gaps** —
the code is shipped and working; these are deployment-environment steps. Clean up
(check off / delete) as each is wired in the production environment.

## Phase 22 — notifications & reminders

- [ ] **Set `CRON_SECRET` in the prod environment (Coolify).** All `/api/cron/*` routes
  are gated by `assertCronSecret` (compares the `x-cron-secret` request header to
  `process.env.CRON_SECRET`). If it's unset, every cron route returns 401, so the
  schedulers below silently no-op.

- [ ] **Schedule the daily birthday/anniversary reminder cron.** Once per day at
  **08:00 UTC**:
  ```
  POST https://<host>/api/cron/birthday-reminders
  Header: x-cron-secret: $CRON_SECRET
  ```
  Scans all eligible users' contacts; dedup is handled internally
  (`BirthdayReminderState`), so re-runs are safe.

- [ ] **Schedule the notification digest cron.** Once per day at **08:00 UTC** (the route
  sends DAILY digests every run and WEEKLY digests only on Mondays — one schedule
  covers both):
  ```
  POST https://<host>/api/cron/digest
  Header: x-cron-secret: $CRON_SECRET
  ```
  Skips users with no unread non-security notifications in the window; marks digested
  rows read.

### Notes / context
- A local dev `CRON_SECRET` was added to the gitignored `.env` for testing — prod needs
  its own value.
- Pre-existing cron `/api/cron/delete-accounts` (account hard-delete grace job) uses the
  same gate and also needs a prod schedule if not already wired — listed here for
  completeness, not introduced by Phase 22.
- Emails only send when all four `AWS_*` SES vars are present (`SES_CONFIGURED`);
  otherwise they log to console. Confirm SES is configured in prod so digest + security
  emails actually deliver.

## Phase 29 — data export (P29-01/02)

- [ ] **Set MinIO env vars in prod (Coolify).** The export ZIP is stored on MinIO and
  served via 48-hour pre-signed URLs. Required vars (same bucket used for avatar uploads):
  ```
  MINIO_ENDPOINT=https://minio.yourdomain.com
  MINIO_ACCESS_KEY=...
  MINIO_SECRET_KEY=...
  MINIO_BUCKET=kontax-uploads
  ```
  If `MINIO_ENDPOINT` is absent the CRON worker will fail and mark the job `FAILED`.

- [ ] **Schedule the data-export worker cron.** Every minute — picks up the oldest
  `PENDING` export job, generates the ZIP, uploads to MinIO, marks `READY`, and emails
  the user. Uses `FOR UPDATE SKIP LOCKED` so concurrent runs are safe:
  ```
  POST https://<host>/api/cron/data-export
  Header: x-cron-secret: $CRON_SECRET
  ```
  If every-minute scheduling is unavailable (Coolify plan limit), every 5 minutes is
  acceptable — just adds latency between request and delivery.

- [ ] **Schedule the expire-exports cron.** Once per hour — marks `READY` export jobs
  whose 48-hour `expiresAt` has passed as `EXPIRED`:
  ```
  POST https://<host>/api/cron/expire-exports
  Header: x-cron-secret: $CRON_SECRET
  ```

## Phase 29 — REST API rate limiting (P29-08)

- [ ] **Confirm `REDIS_URL` is set in prod.** The API rate limiter uses `rate-limiter-flexible`
  with Valkey/Redis (same instance as the login rate limiter). Without `REDIS_URL`, it falls back
  to an in-memory store — safe but not shared across LXC processes.

- [ ] **Schedule the API counter reset cron.** Daily at **00:00 UTC** — the handler only resets
  on the 1st of the month, so daily scheduling is safe:
  ```
  POST https://<host>/api/cron/reset-api-counters
  Header: x-cron-secret: $CRON_SECRET
  ```
