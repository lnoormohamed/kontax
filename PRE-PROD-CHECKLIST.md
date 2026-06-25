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

- [ ] **Schedule the sync runner cron + wire plan-based frequency (do just before launch).**
  The route already exists (`POST /api/cron/sync`, CRON_SECRET-guarded); it enqueues a
  SCHEDULED job for every ACTIVE account due per its `syncFrequencyMinutes` (default 60;
  "Manual only" skipped) and drains the queue. Without a scheduler calling it, sync only
  runs on a manual "Sync now" and queued jobs never drain. Job claiming is atomic, so a
  tick overlapping an inline run is safe. Launch tasks:
  - **Scheduler:** add a Coolify Scheduled Task (or a dedicated cron LXC) that POSTs the
    route. Tick **at least as often as the smallest plan interval** (e.g. every ~2 min if
    paid tiers are 10 min):
    ```
    */2 * * * *  curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/sync
    ```
  - **Plan-based frequency:** derive `syncFrequencyMinutes` from the user's plan and cap it
    server-side so a setting can't beat the plan (free → 60; Pro/Teams/Family → 10 or
    on-change). "On change" is event-driven (enqueue on contact mutation), not the poll —
    and is the point at which a Valkey/BullMQ queue + dedicated sync-worker LXC becomes
    worth it (don't build that until traffic needs it).

- [ ] **Verify Microsoft/Outlook two-way sync on a throwaway account before enabling it.**
  The Microsoft connector now has full two-way (create `POST /me/contacts`, update, delete
  `DELETE /me/contacts/{id}`), but it was **shipped unverified** — it can't be connected
  until the Azure app registration exists and `MICROSOFT_CLIENT_ID/SECRET/REDIRECT_URI` are
  set, so the write paths (**especially delete-on-Outlook**) have never executed. Before any
  real Outlook account uses TWO_WAY, connect a disposable Outlook account and walk the
  create/update/delete cycle, confirming each lands in Outlook and the SyncJob `pushed*Count`
  columns are right.

- [ ] **Guard outbound create against a mass-export surprise (Google + Microsoft).**
  Outbound create pushes *every* user-created (`lastMutatedBy = MANUAL`) contact not yet
  linked to the account. A user who already has manual contacts and *then* connects
  Google/Outlook will, on the first TWO_WAY sync, create all of them on the remote. That is
  correct export behaviour but a big, hard-to-undo action — gate it before real users (e.g.
  only contacts created after the connection, or an explicit "export existing contacts?"
  opt-in).

- [ ] **(Optional) Outbound create for CardDAV.** CardDAV currently pushes updates + deletes
  for existing links only; a brand-new local contact is not created on the CardDAV server
  (its push loop walks existing links only). Google/Outlook do outbound-create; CardDAV does
  not. Add it (scan unlinked local contacts → PUT → create link) with live iCloud/Fastmail
  testing if full parity is wanted.

- [ ] **Relax the first-time CardDAV fan-out gate for sync-originated contacts.** Right now
  first-time CardDAV outbound create only picks up contacts marked `lastMutatedBy = MANUAL`,
  which is conservative but means an iCloud-originated contact will not automatically fan out
  to a second CardDAV account like Fastmail unless it gets a fresh manual edit first. If we
  want multi-CardDAV setups to behave more naturally, loosen that eligibility rule for
  first-time per-account creates and verify the behavior with live iCloud/Fastmail coverage.

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

## Phase 30 — Public card analytics (P30-06)

- [ ] **Schedule the card-view cleanup cron.** Once per day at **03:00 UTC** — deletes
  `PublicCardView` rows older than 90 days to keep the table lean:
  ```
  POST https://<host>/api/cron/cleanup-card-views
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
