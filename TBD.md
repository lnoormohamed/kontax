# TBD — pre-production checklist

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
