# P47-12 — Backups (DB + MinIO) & uptime monitoring

**Phase:** 47 · **Workstream:** D · **Priority:** P1 · **Depends on:** P47-06

## Objective

Ensure production data is recoverable and that outages page a human, before real
users depend on the service.

## Backups

1. **PostgreSQL (LXC 129)** — nightly `pg_dump` of db `kontax` to off-host
   storage (not the same LXC/host). Retain N days. Confirm the schedule and that
   a dump actually lands.
2. **Restore drill** — restore the latest dump into a throwaway DB and confirm
   the app can boot against it (`check-schema-drift.mjs` → 0, sign-in works).
   Follow [../runbooks/db-restore.md](../runbooks/db-restore.md). **A backup that
   has never been restored is not a backup.**
3. **MinIO (LXC 151)** — back up the `kontax-uploads` bucket (mirror to another
   host/bucket, e.g. `mc mirror`, on a schedule). Contact photos are user data.
4. Document RPO/RTO expectations on the checklist.

## Uptime monitoring

1. External uptime checks (independent of the homelab) on:
   - `https://getkontax.com` (app health — a real page or `/api/health`)
   - `https://media.getkontax.com` (a known object 200)
   - a cron liveness signal (e.g. last-run timestamp surfaced, or a heartbeat)
2. Alerting to a channel a human watches (email/SMS/push) on failure.
3. Optional: certificate-expiry monitoring for the TLS hostnames (P47-10).

## Acceptance

- Nightly DB dump confirmed landing off-host; a restore drill passed.
- MinIO bucket backup scheduled and verified.
- Uptime checks live on app + media + cron liveness, alerting a human on failure.
- Recorded on the P47-01 checklist.

## References

- [../runbooks/db-restore.md](../runbooks/db-restore.md) · [../runbooks/incident.md](../runbooks/incident.md)
- Infra memory (LXC inventory)
</content>
